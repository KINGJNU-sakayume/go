import type {
  CaptureOption,
  GameEventPayload,
  JokboId,
  JokboLedgerEntry,
  Month,
  PpeokKind,
  RunState,
  StageCoinBreakdown,
  StageState,
} from '../types';
import { ALL_JOKBO, ALL_MONTHS } from '../types';
import { BALANCE } from '../config/balance';
import { Rng, deriveRng } from '../rng/rng';
import { STAGES } from '../stages/definitions';
import { effectiveRules, identityOf, makeContext, type GameContext } from '../effects/context';
import { hasTalisman } from '../effects/sources';
import { canMatch, getBombOptions, getCaptureOptions } from './match';
import { closeChain, openChain, processEvents, resumeChain } from './trigger';

// ------------------------------------------------------------------ helpers

export function cloneRun(run: RunState): RunState {
  return structuredClone(run);
}

export function stageContext(run: RunState): GameContext {
  const stage = run.stage;
  if (!stage) throw new Error('No active stage');
  return makeContext(run, stage, new Rng(stage.rng), STAGES[stage.stageIndex]);
}

function commit(ctx: GameContext): void {
  if (ctx.stage) ctx.stage.rng = ctx.rng.getState();
}

function emptyLedger(): JokboLedgerEntry {
  return {
    points: 0,
    sets: 0,
    triggers: 0,
    retriggers: 0,
    lastScore: 0,
    totalScore: 0,
    lastTradPoints: 0,
    lastContributors: [],
    memberSnapshot: [],
    members: [],
    stageMultAdd: 0,
  };
}

function freshTurnState(stage: StageState): StageState['turnState'] {
  return {
    scoredJokbo: [],
    playedPlaced: false,
    handCaptureMonths: [],
    handCaptureSingle: false,
    fieldHadCards: stage.field.length > 0,
  };
}

function sharedMonths(ctx: GameContext, a: string, targets: string[], hint?: Month): Month[] {
  if (hint) return [hint];
  const pa = identityOf(ctx, a);
  const out = new Set<Month>();
  for (const t of targets) {
    const it = identityOf(ctx, t);
    for (const m of it.scoringMonths) if (pa.matchMonths.includes(m)) out.add(m);
    for (const m of pa.scoringMonths) if (it.matchMonths.includes(m)) out.add(m);
  }
  return Array.from(out);
}

/** Number of upcoming stock cards visible to the player right now. */
export function visiblePreviewCount(run: RunState): number {
  const stage = run.stage;
  if (!stage) return 0;
  const ctx = stageContext(run);
  let n = stage.previewCount;
  const temp = stage.counters['preview:temp'] ?? 0;
  if (temp && (stage.counters['preview:until'] ?? 0) >= stage.turn) n = Math.max(n, temp);
  if (stage.hand.some((u) => identityOf(ctx, u).enhancements.some((e) => e.id === 'lucky'))) n += 1;
  return Math.min(n, stage.stock.length);
}

function uncoverMatching(ctx: GameContext, uid: string): GameEventPayload[] {
  const stage = ctx.stage!;
  if (!stage.covered.length) return [];
  const played = identityOf(ctx, uid);
  const out: GameEventPayload[] = [];
  for (const c of [...stage.covered]) {
    if (canMatch(played, identityOf(ctx, c))) {
      stage.covered.splice(stage.covered.indexOf(c), 1);
      out.push({ type: 'MESSAGE', text: `장막이 걷혔다: ${identityOf(ctx, c).name}` });
    }
  }
  return out;
}

// ------------------------------------------------------------------ Go-Stop specials

/**
 * 뻑 piles fully contained in `uids` (a capture just took them) are removed; returns how many.
 * Piles that lost a card some other way are dropped silently.
 */
function takePpeokPiles(stage: StageState, uids: string[]): number {
  let eaten = 0;
  stage.ppeokPiles = stage.ppeokPiles.filter((p) => {
    if (p.uids.every((u) => uids.includes(u))) {
      eaten++;
      return false;
    }
    return p.uids.every((u) => stage.field.includes(u));
  });
  return eaten;
}

/** Stack / bomb capture: eating a 뻑 pile is 자뻑 먹기, otherwise a plain 뭉치 획득. */
function stackSpecials(stage: StageState, targetUids: string[], month: Month | undefined, plainStack: boolean): GameEventPayload[] {
  const eaten = takePpeokPiles(stage, targetUids);
  if (eaten > 0) return [{ type: 'SPECIAL_CAPTURE', special: 'ppeokEat', month, count: eaten }];
  return plainStack ? [{ type: 'SPECIAL_CAPTURE', special: 'stack', month, count: 1 }] : [];
}

/** Months the hand could 흔들기 right now: three or more of a month in hand and none of it on the field. */
function shakeMonthsIn(ctx: GameContext): Month[] {
  const stage = ctx.stage!;
  if (!effectiveRules(ctx).shake) return [];
  const out: Month[] = [];
  for (const m of ALL_MONTHS) {
    const inHand = stage.hand.filter((u) => {
      const id = identityOf(ctx, u);
      return !id.joker && id.scoringMonths.includes(m);
    }).length;
    if (inHand < 3) continue;
    if (stage.field.some((u) => identityOf(ctx, u).scoringMonths.includes(m))) continue;
    out.push(m);
  }
  return out;
}

export function shakeableMonths(run: RunState): Month[] {
  if (!run.stage || run.stage.phase !== 'play') return [];
  return shakeMonthsIn(stageContext(run));
}

/** The month this hand card could declare 흔들기 for if played now (undefined: no shake possible). */
export function shakeMonthOf(run: RunState, uid: string): Month | undefined {
  if (!run.stage || run.stage.phase !== 'play' || !run.stage.hand.includes(uid)) return undefined;
  return shakeMonthFor(stageContext(run), uid);
}

/** The month a hand card would 흔들기 if played now (it must belong to a shakeable month). */
function shakeMonthFor(ctx: GameContext, uid: string): Month | undefined {
  const id = identityOf(ctx, uid);
  if (id.joker) return undefined;
  const months = shakeMonthsIn(ctx);
  return id.scoringMonths.find((m) => months.includes(m));
}

interface PpeokPlan {
  /** Jokers revealed (and taken as service cards) before the stock card that makes the 뻑. */
  jokers: string[];
  stockUid: string;
  month: Month;
}

/**
 * 뻑: the hand card pairs with one field card, then the stock card turns out to be the same month with
 * nothing else to take — all three stay stacked on the field. Decided before the hand capture resolves,
 * because in the real game both cards land before anything is collected.
 */
function planPpeok(ctx: GameContext, uid: string, option: CaptureOption): PpeokPlan | undefined {
  const stage = ctx.stage!;
  if (option.kind !== 'single' || !effectiveRules(ctx).ppeok) return undefined;
  const jokers: string[] = [];
  let i = 0;
  for (; i < stage.stock.length; i++) {
    const id = identityOf(ctx, stage.stock[i]);
    if (!id.joker) break;
    // a universal Joker captures from the field itself — the normal stock phase handles that turn
    if (id.jokerForm === 'universal') return undefined;
    jokers.push(stage.stock[i]);
  }
  const stockUid = stage.stock[i];
  if (!stockUid) return undefined;
  const sid = identityOf(ctx, stockUid);
  const month = sharedMonths(ctx, uid, option.targetUids, option.month).find(
    (m) => sid.wild || sid.matchMonths.includes(m) || sid.scoringMonths.includes(m),
  );
  if (month === undefined) return undefined;
  const rest = stage.field.filter((f) => !option.targetUids.includes(f));
  if (getCaptureOptions(ctx, stockUid, rest).some((o) => o.kind !== 'place')) return undefined;
  return { jokers, stockUid, month };
}

function ppeokKind(stage: StageState): PpeokKind {
  if (stage.ppeokCount + 1 === 3) return 'triple';
  if (stage.lastPpeokTurn !== undefined && stage.lastPpeokTurn === stage.turn - 1) return 'chain';
  if (stage.turn === 1) return 'first';
  return 'normal';
}

function resolvePpeok(ctx: GameContext, uid: string, option: CaptureOption, plan: PpeokPlan, shakeMonth?: Month): void {
  const stage = ctx.stage!;
  openChain(ctx, `${stage.turn}턴 · ${identityOf(ctx, uid).name}`);
  stage.hand.splice(stage.hand.indexOf(uid), 1);
  stage.turnState.playedUid = uid;
  const roots: GameEventPayload[] = [{ type: 'CARD_PLAYED', cardUid: uid }, ...uncoverMatching(ctx, uid)];
  if (shakeMonth !== undefined) roots.push({ type: 'SHAKE_DECLARED', month: shakeMonth, cause: 'shake' });
  processEvents(ctx, roots.map((payload) => ({ payload })));
  for (const j of plan.jokers) {
    stage.stock.splice(stage.stock.indexOf(j), 1);
    const actionId = stage.nextActionId++;
    processEvents(
      ctx,
      [
        { type: 'STOCK_REVEALED', cardUid: j },
        { type: 'JOKER_REVEALED', cardUid: j },
        { type: 'CARD_CAPTURED', cardUid: j, from: 'service', actionId },
      ].map((payload) => ({ payload: payload as GameEventPayload })),
    );
  }
  const s = plan.stockUid;
  stage.stock.splice(stage.stock.indexOf(s), 1);
  const target = option.targetUids[0];
  const at = stage.field.indexOf(target);
  // keep the pile together on the field: hand card and stock card land right after their partner
  stage.field.splice(at >= 0 ? at + 1 : stage.field.length, 0, uid, s);
  const kind = ppeokKind(stage);
  processEvents(
    ctx,
    [
      { type: 'STOCK_REVEALED', cardUid: s } as GameEventPayload,
      ...uncoverMatching(ctx, s),
      { type: 'PPEOK', month: plan.month, cardUids: [target, uid, s], kind } as GameEventPayload,
    ].map((payload) => ({ payload })),
  );
}

// ------------------------------------------------------------------ stage start

export function createStage(run: RunState, stageIndex: number): void {
  const def = STAGES[stageIndex];
  const rng = deriveRng(run.seed, 'stage', stageIndex);
  const rules = effectiveRules(makeContext(run, undefined, rng));
  const handSize = def.handSize ?? rules.handSize;
  const fieldSize = def.fieldSize ?? rules.fieldSize;
  const turns = def.turns ?? rules.turnsPerStage;
  let target = def.target;
  if (def.boss && run.modifiers.bossTargetMult !== 1) {
    target = Math.round(target * run.modifiers.bossTargetMult);
    run.modifiers.bossTargetMult = 1;
  }
  const order = rng.shuffle(run.deck.map((c) => c.uid));
  const hand = order.slice(0, handSize);
  const field = order.slice(handSize, handSize + fieldSize);
  const stock = order.slice(handSize + fieldSize);
  const ledger = {} as Record<JokboId, JokboLedgerEntry>;
  for (const id of ALL_JOKBO) ledger[id] = emptyLedger();

  const stage: StageState = {
    stageIndex,
    turn: 1,
    turnsTotal: turns,
    phase: 'play',
    hand,
    field,
    stock,
    captured: [],
    discard: [],
    covered: [],
    score: 0,
    target,
    goCount: 0,
    goBust: false,
    exchangesLeft: Math.max(0, rules.exchangesPerStage + run.modifiers.nextStageExchangeBonus),
    exchangesUsed: 0,
    freeExchangesUsed: 0,
    previewCount: rules.basePreview + (def.mechanics.previewStock ?? 0),
    temp: {},
    ledger,
    counters: {},
    flags: {},
    usage: {},
    globalMultAdd: run.modifiers.nextStageGlobalAdd,
    globalMultFactor: run.modifiers.nextStageScoreMult,
    monthMult: {},
    drunk: 0,
    scoredEffects: 0,
    retriggersThisStage: 0,
    rng: rng.getState(),
    chains: [],
    nextEventId: 1,
    nextChainId: 1,
    turnState: { scoredJokbo: [], playedPlaced: false, handCaptureMonths: [], handCaptureSingle: false, fieldHadCards: true },
    captureActions: [],
    nextActionId: 1,
    firstUnmatchedApplied: false,
    activatedRibbonSets: [],
    coinsEarned: 0,
    bestChainScore: 0,
    longestChain: 0,
    overflowed: false,
    handOrderSeed: 0,
    ppeokPiles: [],
    ppeokCount: 0,
    bonusPi: 0,
    shakeCount: 0,
  };
  run.modifiers.nextStageExchangeBonus = 0;
  run.modifiers.nextStageGlobalAdd = 0;
  run.modifiers.nextStageScoreMult = 1;
  run.stage = stage;
  run.phase = 'stage';
  run.stageResult = undefined;
  run.stageIndex = stageIndex;

  const ctx = stageContext(run);
  openChain(ctx, `${def.month}월 · ${def.name}`);
  const roots: GameEventPayload[] = [{ type: 'STAGE_STARTED' }];
  // Jokers dealt to the field are taken immediately as service cards and replaced.
  let guard = 0;
  while (guard++ < 20) {
    const joker = stage.field.find((u) => identityOf(ctx, u).joker);
    if (!joker) break;
    stage.field.splice(stage.field.indexOf(joker), 1);
    const refill = stage.stock.shift();
    if (refill) stage.field.push(refill);
    const actionId = stage.nextActionId++;
    roots.push({ type: 'JOKER_REVEALED', cardUid: joker }, { type: 'CARD_CAPTURED', cardUid: joker, from: 'service', actionId });
  }
  // 총통: four or more cards of one month (or all five 광) in the opening hand. The real game lets the
  // holder end the hand on the spot; a roguelike stage is won on score, so 총통 always plays on:
  // a bonus plus one 흔들기 stack for the whole stage.
  const monthCounts = new Map<Month, number>();
  let brights = 0;
  for (const u of stage.hand) {
    const id = identityOf(ctx, u);
    if (id.joker) continue;
    if (id.bright) brights++;
    // same month basis as 흔들기 / 폭탄: every scoring month (갈라진 달 included)
    for (const m of id.scoringMonths) monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
  }
  let chongtong = false;
  for (const [m, n] of monthCounts) {
    if (n < 4) continue;
    roots.push({ type: 'SPECIAL_CAPTURE', special: 'chongtong', month: m, count: n - 3 });
    chongtong = true;
  }
  if (brights >= 5) {
    roots.push({ type: 'SPECIAL_CAPTURE', special: 'chongtong', count: 1 });
    chongtong = true;
  }
  if (chongtong && rules.shake) roots.push({ type: 'SHAKE_DECLARED', cause: 'chongtong' });
  processEvents(ctx, roots.map((payload) => ({ payload })));
  closeChain(ctx);
  beginTurn(ctx);
  commit(ctx);
}

function beginTurn(ctx: GameContext): void {
  const stage = ctx.stage!;
  stage.turnState = freshTurnState(stage);
  for (const k of Object.keys(stage.counters)) if (k.startsWith('turn:')) delete stage.counters[k];
  if ((stage.counters['preview:until'] ?? 0) < stage.turn) {
    delete stage.counters['preview:temp'];
    delete stage.counters['preview:until'];
  }
  openChain(ctx, `${stage.turn}턴 시작`);
  processEvents(ctx, [{ payload: { type: 'TURN_STARTED', turn: stage.turn } }]);
  closeChain(ctx);
  stage.phase = 'play';
}

// ------------------------------------------------------------------ queries

export function handCaptureOptions(run: RunState, uid: string): CaptureOption[] {
  const ctx = stageContext(run);
  return getCaptureOptions(ctx, uid, ctx.stage!.field);
}

export function bombOptions(run: RunState) {
  return getBombOptions(stageContext(run));
}

export interface ExchangeCheck {
  ok: boolean;
  free: boolean;
  reason?: string;
}

export function canExchange(run: RunState, uid: string): ExchangeCheck {
  const stage = run.stage;
  if (!stage || stage.phase !== 'play') return { ok: false, free: false, reason: '지금은 교환할 수 없음' };
  if (!stage.hand.includes(uid)) return { ok: false, free: false, reason: '손패가 아님' };
  if (!stage.stock.length) return { ok: false, free: false, reason: '더미가 비었음' };
  const ctx = stageContext(run);
  const id = identityOf(ctx, uid);
  if (id.mutations.some((m) => m.id === 'stubborn')) return { ok: false, free: false, reason: '고집: 교환 불가' };
  const free = hasTalisman(ctx, 'pi-sieve') && id.piValue > 0 && !stage.flags['piSieveUsed'];
  if (!free && stage.exchangesLeft <= 0) return { ok: false, free: false, reason: '교환 횟수 없음' };
  return { ok: true, free };
}

// ------------------------------------------------------------------ actions

function resolveHandPlay(ctx: GameContext, uid: string, option: CaptureOption, shakeMonth?: Month): void {
  const stage = ctx.stage!;
  openChain(ctx, `${stage.turn}턴 · ${identityOf(ctx, uid).name}`);
  const idx = stage.hand.indexOf(uid);
  if (idx >= 0) stage.hand.splice(idx, 1);
  stage.turnState.playedUid = uid;
  const roots: GameEventPayload[] = [{ type: 'CARD_PLAYED', cardUid: uid }, ...uncoverMatching(ctx, uid)];
  if (shakeMonth !== undefined) roots.push({ type: 'SHAKE_DECLARED', month: shakeMonth, cause: 'shake' });
  if (option.kind === 'place') {
    stage.field.push(uid);
    stage.turnState.playedPlaced = true;
    roots.push({ type: 'CARD_PLACED', cardUid: uid, from: 'hand' });
  } else {
    const actionId = stage.nextActionId++;
    const months = sharedMonths(ctx, uid, option.targetUids, option.month);
    stage.captureActions.push({ id: actionId, months, uids: [uid, ...option.targetUids] });
    stage.turnState.handCaptureMonths = months;
    stage.turnState.handCaptureSingle = option.kind === 'single';
    roots.push({ type: 'CARD_CAPTURED', cardUid: uid, from: 'hand', partnerUid: option.targetUids[0], actionId });
    for (const t of option.targetUids) roots.push({ type: 'CARD_CAPTURED', cardUid: t, from: 'hand', partnerUid: uid, actionId });
    roots.push({ type: 'CARD_MATCHED', cardUid: uid, targetUids: option.targetUids, from: 'hand' });
    roots.push(...stackSpecials(stage, option.targetUids, option.month, option.kind === 'stack'));
  }
  processEvents(ctx, roots.map((payload) => ({ payload })));
}

function resolveStockCapture(ctx: GameContext, s: string, option: CaptureOption, pre: GameEventPayload[] = []): void {
  const stage = ctx.stage!;
  const roots: GameEventPayload[] = [...pre];
  if (option.kind === 'place') {
    stage.field.push(s);
    roots.push({ type: 'CARD_PLACED', cardUid: s, from: 'stock' });
  } else {
    const actionId = stage.nextActionId++;
    const months = sharedMonths(ctx, s, option.targetUids, option.month);
    stage.captureActions.push({ id: actionId, months, uids: [s, ...option.targetUids] });
    const ts = stage.turnState;
    roots.push({ type: 'CARD_CAPTURED', cardUid: s, from: 'stock', partnerUid: option.targetUids[0], actionId });
    for (const t of option.targetUids) roots.push({ type: 'CARD_CAPTURED', cardUid: t, from: 'stock', partnerUid: s, actionId });
    roots.push({ type: 'CARD_MATCHED', cardUid: s, targetUids: option.targetUids, from: 'stock' });
    roots.push(...stackSpecials(stage, option.targetUids, option.month, option.kind === 'stack'));
    if (ts.playedPlaced && ts.playedUid && option.targetUids.includes(ts.playedUid)) {
      roots.push({ type: 'SPECIAL_CAPTURE', special: 'jjok', month: months[0] });
    } else if (!ts.playedPlaced && ts.handCaptureSingle && months.some((m) => ts.handCaptureMonths.includes(m))) {
      roots.push({ type: 'SPECIAL_CAPTURE', special: 'ttadak', month: months[0] });
      if (stage.turn === 1) roots.push({ type: 'SPECIAL_CAPTURE', special: 'firstTtadak', month: months[0] });
    }
  }
  processEvents(ctx, roots.map((payload) => ({ payload })));
}

/** Reveals stock cards until one normal card resolves (Jokers are taken and re-revealed). */
function runStockPhase(ctx: GameContext): 'done' | 'pending' {
  const stage = ctx.stage!;
  let guard = 0;
  while (guard++ < 60) {
    const s = stage.stock.shift();
    if (!s) return 'done';
    const id = identityOf(ctx, s);
    const pre: GameEventPayload[] = [{ type: 'STOCK_REVEALED', cardUid: s }, ...uncoverMatching(ctx, s)];
    if (id.joker) {
      if (id.jokerForm === 'universal' && stage.field.length) {
        const options = getCaptureOptions(ctx, s, stage.field);
        processEvents(ctx, [...pre, { type: 'JOKER_REVEALED', cardUid: s } as GameEventPayload].map((payload) => ({ payload })));
        if (options.length === 1) {
          resolveUniversal(ctx, s, options[0]);
          continue;
        }
        stage.pending = { kind: 'stock', cardUid: s, options };
        stage.phase = 'chooseStockTarget';
        return 'pending';
      }
      const actionId = stage.nextActionId++;
      processEvents(
        ctx,
        [...pre, { type: 'JOKER_REVEALED', cardUid: s }, { type: 'CARD_CAPTURED', cardUid: s, from: 'service', actionId }].map(
          (payload) => ({ payload: payload as GameEventPayload }),
        ),
      );
      continue;
    }
    const options = getCaptureOptions(ctx, s, stage.field);
    if (options.length === 1) {
      resolveStockCapture(ctx, s, options[0], pre);
      return 'done';
    }
    processEvents(ctx, pre.map((payload) => ({ payload })));
    stage.pending = { kind: 'stock', cardUid: s, options };
    stage.phase = 'chooseStockTarget';
    return 'pending';
  }
  return 'done';
}

function resolveUniversal(ctx: GameContext, s: string, option: CaptureOption): void {
  const stage = ctx.stage!;
  const actionId = stage.nextActionId++;
  const roots: GameEventPayload[] = [{ type: 'CARD_CAPTURED', cardUid: s, from: 'service', partnerUid: option.targetUids[0], actionId }];
  for (const t of option.targetUids) roots.push({ type: 'CARD_CAPTURED', cardUid: t, from: 'service', partnerUid: s, actionId });
  roots.push(...stackSpecials(stage, option.targetUids, option.month, false));
  stage.captureActions.push({ id: actionId, months: sharedMonths(ctx, s, option.targetUids, option.month), uids: [s, ...option.targetUids] });
  processEvents(ctx, roots.map((payload) => ({ payload })));
}

function finishTurn(ctx: GameContext): void {
  const stage = ctx.stage!;
  takePpeokPiles(stage, []);
  const roots: GameEventPayload[] = [];
  if (stage.turnState.fieldHadCards && stage.field.length === 0) roots.push({ type: 'SPECIAL_CAPTURE', special: 'sweep' });
  roots.push({ type: 'TURN_ENDED', turn: stage.turn });
  if (!ctx.chain) openChain(ctx, `${stage.turn}턴 종료`);
  processEvents(ctx, roots.map((payload) => ({ payload })));
  closeChain(ctx);
  stage.phase = 'play';
  if (stage.turn >= stage.turnsTotal || stage.hand.length === 0) {
    endStage(ctx);
    return;
  }
  const rules = effectiveRules(ctx);
  const line = stage.goLine ?? stage.target;
  if (rules.goEnabled && stage.score >= line) {
    stage.phase = 'goStop';
    return;
  }
  stage.turn++;
  beginTurn(ctx);
}

function assertPhase(stage: StageState, ...phases: StageState['phase'][]): void {
  if (!phases.includes(stage.phase)) throw new Error(`Invalid stage phase ${stage.phase}; expected ${phases.join('/')}`);
}

export interface PlayOptions {
  /** Declare 흔들기 with this card (it must belong to a shakeable month). */
  shake?: boolean;
}

/**
 * Play a hand card. If several capture targets exist and no option is given, the stage waits for a choice.
 * 흔들기 is never automatic: pass `{ shake: true }` to declare it with this card.
 */
export function playCard(run: RunState, uid: string, optionId?: string, opts: PlayOptions = {}): RunState {
  const next = cloneRun(run);
  const ctx = stageContext(next);
  const stage = ctx.stage!;
  if (stage.phase === 'chooseHandTarget') {
    if (stage.pending?.cardUid !== uid) {
      stage.pending = undefined;
      stage.phase = 'play';
    }
  } else assertPhase(stage, 'play');
  if (!stage.hand.includes(uid)) throw new Error(`Card ${uid} is not in hand`);
  const shakeMonth = opts.shake ? shakeMonthFor(ctx, uid) : undefined;
  if (opts.shake && shakeMonth === undefined) throw new Error('이 패로는 흔들 수 없음');
  const options = getCaptureOptions(ctx, uid, stage.field);
  let option: CaptureOption | undefined;
  if (optionId) {
    option = options.find((o) => o.id === optionId);
    if (!option) throw new Error(`Unknown capture option ${optionId}`);
  } else if (options.length === 1) {
    option = options[0];
  } else {
    stage.pending = { kind: 'hand', cardUid: uid, options, shake: opts.shake || undefined };
    stage.phase = 'chooseHandTarget';
    commit(ctx);
    return next;
  }
  stage.pending = undefined;
  stage.phase = 'play';
  const ppeok = planPpeok(ctx, uid, option);
  if (ppeok) {
    resolvePpeok(ctx, uid, option, ppeok, shakeMonth);
    finishTurn(ctx);
  } else {
    resolveHandPlay(ctx, uid, option, shakeMonth);
    if (runStockPhase(ctx) === 'done') finishTurn(ctx);
  }
  commit(ctx);
  return next;
}

export function cancelHandChoice(run: RunState): RunState {
  const next = cloneRun(run);
  const stage = next.stage!;
  if (stage.phase === 'chooseHandTarget') {
    stage.pending = undefined;
    stage.phase = 'play';
  }
  return next;
}

/** Resolve a pending capture-target choice (hand or stock). */
export function chooseTarget(run: RunState, optionId: string): RunState {
  const stage = run.stage!;
  const pending = stage.pending;
  if (!pending) throw new Error('No pending choice');
  if (pending.kind === 'hand') return playCard(run, pending.cardUid, optionId, { shake: pending.shake });
  if (pending.kind !== 'stock') throw new Error('Pending choice is not a capture target');
  const next = cloneRun(run);
  const ctx = stageContext(next);
  const st = ctx.stage!;
  const p = st.pending!;
  const option = p.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`Unknown option ${optionId}`);
  st.pending = undefined;
  st.phase = 'play';
  if (!resumeChain(ctx)) openChain(ctx, `${st.turn}턴 · 더미`);
  const s = p.cardUid;
  let result: 'done' | 'pending' = 'done';
  if (identityOf(ctx, s).joker) {
    resolveUniversal(ctx, s, option);
    result = runStockPhase(ctx);
  } else {
    resolveStockCapture(ctx, s, option);
  }
  if (result === 'done') finishTurn(ctx);
  commit(ctx);
  return next;
}

export function playBomb(run: RunState, month: Month): RunState {
  const next = cloneRun(run);
  const ctx = stageContext(next);
  const stage = ctx.stage!;
  assertPhase(stage, 'play');
  const opt = getBombOptions(ctx).find((o) => o.month === month);
  if (!opt) throw new Error(`No bomb available for month ${month}`);
  openChain(ctx, `${stage.turn}턴 · 폭탄 ${month}월`);
  for (const u of opt.handUids) stage.hand.splice(stage.hand.indexOf(u), 1);
  const actionId = stage.nextActionId++;
  stage.captureActions.push({ id: actionId, months: [month], uids: [...opt.handUids, ...opt.fieldUids] });
  stage.turnState.handCaptureMonths = [month];
  stage.turnState.handCaptureSingle = false;
  stage.turnState.playedUid = opt.handUids[0];
  const roots: GameEventPayload[] = [];
  for (const u of opt.handUids) roots.push({ type: 'CARD_PLAYED', cardUid: u });
  // 폭탄 counts as 흔들기: the multiplier is on before the bomb's own cards score
  if (effectiveRules(ctx).shake) roots.push({ type: 'SHAKE_DECLARED', month, cause: 'bomb' });
  for (const u of [...opt.handUids, ...opt.fieldUids]) roots.push({ type: 'CARD_CAPTURED', cardUid: u, from: 'bomb', actionId });
  roots.push({ type: 'CARD_MATCHED', cardUid: opt.handUids[0], targetUids: opt.fieldUids, from: 'hand' });
  roots.push({ type: 'SPECIAL_CAPTURE', special: 'bomb', month, count: opt.handUids.length - 2 });
  roots.push(...stackSpecials(stage, opt.fieldUids, month, false));
  processEvents(ctx, roots.map((payload) => ({ payload })));
  const draws: GameEventPayload[] = [];
  for (let i = 0; i < opt.handUids.length - 1; i++) {
    const d = stage.stock.shift();
    if (!d) break;
    stage.hand.push(d);
    draws.push({ type: 'CARD_DRAWN', cardUid: d, reason: 'refill' });
  }
  if (draws.length) processEvents(ctx, draws.map((payload) => ({ payload })));
  if (runStockPhase(ctx) === 'done') finishTurn(ctx);
  commit(ctx);
  return next;
}

function doExchange(ctx: GameContext, uid: string, drawn: string, free: boolean): void {
  const stage = ctx.stage!;
  const slot = stage.hand.indexOf(uid);
  stage.hand.splice(slot, 1);
  stage.discard.push(uid);
  stage.stock.splice(stage.stock.indexOf(drawn), 1);
  stage.hand.splice(slot, 0, drawn);
  stage.exchangesUsed++;
  if (free) {
    stage.flags['piSieveUsed'] = true;
    stage.freeExchangesUsed++;
  } else {
    stage.exchangesLeft = Math.max(0, stage.exchangesLeft - 1);
  }
  openChain(ctx, `${stage.turn}턴 · 교환`);
  processEvents(ctx, [
    { payload: { type: 'EXCHANGE_USED', discardedUid: uid, drawnUid: drawn, free } },
    { payload: { type: 'CARD_DRAWN', cardUid: drawn, reason: 'exchange' } },
  ]);
  closeChain(ctx);
}

export function exchangeCard(run: RunState, uid: string): RunState {
  const check = canExchange(run, uid);
  if (!check.ok) throw new Error(check.reason ?? 'Cannot exchange');
  const next = cloneRun(run);
  const ctx = stageContext(next);
  const stage = ctx.stage!;
  const lucky = stage.hand.some((u) => identityOf(ctx, u).enhancements.some((e) => e.id === 'lucky'));
  if (lucky && stage.stock.length >= 2) {
    stage.pending = { kind: 'exchange', cardUid: uid, options: [], candidates: stage.stock.slice(0, 2), free: check.free };
    stage.phase = 'chooseExchange';
    commit(ctx);
    return next;
  }
  doExchange(ctx, uid, stage.stock[0], check.free);
  commit(ctx);
  return next;
}

export function chooseExchange(run: RunState, keepUid: string): RunState {
  const next = cloneRun(run);
  const ctx = stageContext(next);
  const stage = ctx.stage!;
  assertPhase(stage, 'chooseExchange');
  const p = stage.pending!;
  const candidates = p.candidates ?? [];
  if (!candidates.includes(keepUid)) throw new Error('Not a candidate');
  stage.pending = undefined;
  stage.phase = 'play';
  for (const c of candidates) {
    if (c === keepUid) continue;
    stage.stock.splice(stage.stock.indexOf(c), 1);
    stage.stock.push(c);
  }
  doExchange(ctx, p.cardUid, keepUid, !!p.free);
  commit(ctx);
  return next;
}

export function chooseGo(run: RunState): RunState {
  const next = cloneRun(run);
  const ctx = stageContext(next);
  const stage = ctx.stage!;
  assertPhase(stage, 'goStop');
  const def = STAGES[stage.stageIndex];
  stage.goCount++;
  next.stats.goDecisions++;
  stage.goLine = Math.round(stage.score * def.goHazard.lineMult);
  stage.turn++;
  beginTurn(ctx);
  commit(ctx);
  return next;
}

export function chooseStop(run: RunState): RunState {
  const next = cloneRun(run);
  const ctx = stageContext(next);
  assertPhase(ctx.stage!, 'goStop');
  endStage(ctx);
  commit(ctx);
  return next;
}

// ------------------------------------------------------------------ stage end

function endStage(ctx: GameContext): void {
  const stage = ctx.stage!;
  const run = ctx.run;
  const def = STAGES[stage.stageIndex];
  openChain(ctx, '스테이지 정산');
  processEvents(ctx, [{ payload: { type: 'STAGE_ENDING' } }]);
  const cleared = stage.score >= stage.target;
  const bust = stage.goCount > 0 && stage.goLine !== undefined && stage.score < stage.goLine;
  if (cleared) processEvents(ctx, [{ payload: { type: 'STAGE_CLEARED' } }]);
  closeChain(ctx);
  stage.phase = cleared ? 'cleared' : 'failed';
  stage.goBust = bust;

  const coins: StageCoinBreakdown = { base: 0, overkill: 0, go: 0, talismans: stage.coinsEarned, bustPenalty: 0, total: 0 };
  if (cleared) {
    coins.base = def.coinReward;
    const over = stage.target > 0 ? (stage.score - stage.target) / stage.target : 0;
    coins.overkill = Math.min(BALANCE.overkillCoinMax, Math.max(0, Math.floor(over / BALANCE.overkillCoinStep)));
    const goRate = def.goHazard.coinBonusPerGo + (def.mechanics.goRewardBonus ?? 0);
    coins.go = Math.round(def.coinReward * goRate * stage.goCount);
    if (bust) {
      coins.bustPenalty = coins.base + coins.overkill + coins.go;
      const extra = Math.floor(run.coins * def.goHazard.bustCoinLoss);
      coins.bustPenalty += extra;
      run.coins = Math.max(0, run.coins - extra);
      coins.total = 0;
      run.stats.goBusts++;
    } else {
      coins.total = coins.base + coins.overkill + coins.go;
      run.coins += coins.total;
      run.stats.coinsEarned += coins.total;
    }
    run.stats.stagesCleared++;
    if (def.boss) run.stats.bossesDefeated++;
  }
  run.stats.totalScore += stage.score;
  run.stats.stageScores[stage.stageIndex] = stage.score;
  run.stageResult = {
    stageIndex: stage.stageIndex,
    cleared,
    score: stage.score,
    target: stage.target,
    goCount: stage.goCount,
    bust,
    coins,
    bestChain: stage.bestChainScore,
    longestChain: stage.longestChain,
  };
  run.phase = 'stageResult';
}

/** True when the run can be saved without capturing a half-resolved turn. */
export function isSafePoint(run: RunState): boolean {
  if (run.phase !== 'stage') return true;
  const stage = run.stage;
  if (!stage) return true;
  if (stage.chains.some((c) => c.open)) return false;
  return stage.phase === 'play' || stage.phase === 'goStop' || stage.phase === 'cleared' || stage.phase === 'failed';
}

export type { StageState };
