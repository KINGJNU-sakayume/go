import type {
  ChainStep,
  ChainStepKind,
  ChainTone,
  CopiedProfile,
  GameEvent,
  GameEventPayload,
  JokboId,
  PpeokKind,
  ShakeCause,
  SourceRef,
  SpecialCaptureKind,
  StageState,
  TriggerChain,
} from '../types';
import { ALL_JOKBO } from '../types';
import { BALANCE } from '../config/balance';
import {
  capturedProfiles,
  effectiveRules,
  ensureTemp,
  findCard,
  identityOf,
  invalidate,
  jokboEvalRules,
  mostCommonMonth,
  type ChainRuntime,
  type GameContext,
} from '../effects/context';
import { conditionsPass, type EvalScope } from '../effects/evaluate';
import { runReaction } from '../effects/interpret';
import { specsFor, type ActiveSource } from '../effects/sources';
import { CUSTOM_CORE } from './customCore';
import { evaluateAllJokbo } from '../jokbo/evaluate';
import { JOKBO_DEFS, RIBBON_SET_IDS } from '../jokbo/definitions';
import { ENHANCEMENTS } from '../cards/enhancements';
import { computeBonusScore, computeCaptureScore, computeJokboScore, shakeFactor } from '../scoring/pipeline';
import { onCardLevelChange } from './levelups';

export const CORE_SOURCE: SourceRef = { kind: 'core', id: 'core', label: '규칙' };

const MAX_CHAINS_KEPT = 80;

// ------------------------------------------------------------------ chains

export function openChain(ctx: GameContext, title: string): ChainRuntime {
  const stage = ctx.stage!;
  const chain: TriggerChain = {
    id: stage.nextChainId++,
    title,
    turn: stage.turn,
    steps: [],
    totalScore: 0,
    triggerCount: 0,
    distinctSources: [],
    scoreEvents: 0,
    overflow: false,
    resolutions: 0,
    open: true,
  };
  stage.chains.push(chain);
  if (stage.chains.length > MAX_CHAINS_KEPT) stage.chains.splice(0, stage.chains.length - MAX_CHAINS_KEPT);
  const runtime: ChainRuntime = { chain, signatureCounts: new Map(), sources: new Set() };
  ctx.chain = runtime;
  return runtime;
}

/** Re-attaches to the open chain of this stage (after a mid-turn player choice). */
export function resumeChain(ctx: GameContext): ChainRuntime | undefined {
  const stage = ctx.stage!;
  const chain = [...stage.chains].reverse().find((c) => c.open);
  if (!chain) return undefined;
  const runtime: ChainRuntime = { chain, signatureCounts: new Map(), sources: new Set(chain.distinctSources) };
  ctx.chain = runtime;
  return runtime;
}

export function closeChain(ctx: GameContext): void {
  const rt = ctx.chain;
  if (!rt) return;
  const stage = ctx.stage!;
  rt.chain.open = false;
  rt.chain.distinctSources = Array.from(rt.sources);
  stage.bestChainScore = Math.max(stage.bestChainScore, rt.chain.totalScore);
  stage.longestChain = Math.max(stage.longestChain, rt.chain.triggerCount);
  const stats = ctx.run.stats;
  if (rt.chain.totalScore > stats.highestChainScore) {
    stats.highestChainScore = rt.chain.totalScore;
    stats.highestChainTitle = rt.chain.title;
  }
  stats.longestChain = Math.max(stats.longestChain, rt.chain.triggerCount);
  if (rt.chain.overflow) stats.overflowCount++;
  // drop empty chains (nothing visible happened)
  if (rt.chain.steps.length === 0) {
    const idx = stage.chains.indexOf(rt.chain);
    if (idx >= 0) stage.chains.splice(idx, 1);
  }
  ctx.chain = undefined;
}

// ------------------------------------------------------------------ zones

export function removeFromZones(stage: StageState, uid: string): void {
  for (const zone of [stage.hand, stage.field, stage.stock, stage.discard] as string[][]) {
    const i = zone.indexOf(uid);
    if (i >= 0) zone.splice(i, 1);
  }
  const c = stage.covered.indexOf(uid);
  if (c >= 0) stage.covered.splice(c, 1);
}

function copiedProfileOf(ctx: GameContext, fromUid: string): CopiedProfile {
  const id = identityOf(ctx, fromUid);
  return {
    fromUid,
    fromName: id.name,
    months: id.scoringMonths,
    bright: id.bright,
    rainBright: id.rainBright,
    animal: id.animal,
    ribbonTypes: id.ribbonType ? [id.ribbonType] : [],
    countsAsRibbon: id.countsAsRibbon,
    pi: id.piValue,
  };
}

// ------------------------------------------------------------------ processing

interface Child {
  payload: GameEventPayload;
  source: SourceRef;
  essential: boolean;
  announce?: string;
}

interface CoreResult {
  before: GameEventPayload[];
  after: GameEventPayload[];
}

const ALWAYS_ESSENTIAL = new Set<GameEventPayload['type']>(['SCORE_ADDED', 'COINS_GAINED']);

function signatureOf(ev: GameEvent): string {
  const p = ev as GameEvent & { jokboId?: JokboId; cardUid?: string };
  return `${ev.source.kind}:${ev.source.id}:${ev.source.cardUid ?? ''}:${ev.type}:${p.jokboId ?? p.cardUid ?? ''}`;
}

function makeEvent(ctx: GameContext, child: Child, depth: number, parentId?: number): GameEvent {
  const stage = ctx.stage!;
  return {
    ...child.payload,
    id: stage.nextEventId++,
    chainId: ctx.chain?.chain.id ?? -1,
    depth,
    parentId,
    source: child.source,
    essential: child.essential || ALWAYS_ESSENTIAL.has(child.payload.type),
    announce: child.announce,
  } as GameEvent;
}

function limitKey(source: ActiveSource, specIndex: number): string {
  return `${source.key}#${specIndex}`;
}

function consumeLimit(ctx: GameContext, source: ActiveSource, specIndex: number, limit: { perStage?: number; perTurn?: number; perChain?: number } | undefined): boolean {
  if (!limit) return true;
  const stage = ctx.stage!;
  const base = limitKey(source, specIndex);
  const keys: [string, number][] = [];
  if (limit.perStage !== undefined) keys.push([`${base}@stage`, limit.perStage]);
  if (limit.perTurn !== undefined) keys.push([`${base}@turn${stage.turn}`, limit.perTurn]);
  if (limit.perChain !== undefined) keys.push([`${base}@chain${ctx.chain?.chain.id ?? -1}`, limit.perChain]);
  for (const [k, max] of keys) if ((stage.usage[k] ?? 0) >= max) return false;
  for (const [k] of keys) stage.usage[k] = (stage.usage[k] ?? 0) + 1;
  return true;
}

function collectReactions(ctx: GameContext, ev: GameEvent): Child[] {
  const out: Child[] = [];
  for (const { source, spec, specIndex } of specsFor(ctx, ev.type)) {
    const scope: EvalScope = { ctx, source, event: ev };
    if (!conditionsPass(spec.conditions, scope)) continue;
    if (!consumeLimit(ctx, source, specIndex, spec.limit)) continue;
    const payloads = runReaction(scope, spec);
    if (!payloads.length) continue;
    const rt = ctx.chain;
    if (rt) {
      rt.sources.add(source.key.split(':').slice(0, 2).join(':'));
      rt.chain.triggerCount++;
    }
    const shout = spec.shout ?? source.ref.label;
    payloads.forEach((payload, i) => {
      out.push({ payload, source: source.ref, essential: false, announce: i === 0 ? shout : undefined });
    });
  }
  return out;
}

function pushStep(ctx: GameContext, step: Omit<ChainStep, 'id' | 'chainCount'>): void {
  const rt = ctx.chain;
  if (!rt) return;
  rt.chain.steps.push({ ...step, id: rt.chain.steps.length, chainCount: rt.chain.triggerCount });
}

function triggerOverflow(ctx: GameContext, depth: number): void {
  const rt = ctx.chain;
  if (!rt || rt.chain.overflow) return;
  rt.chain.overflow = true;
  if (ctx.stage) ctx.stage.overflowed = true;
  pushStep(ctx, {
    kind: 'overflow',
    depth,
    title: '과열!',
    detail: '반복 루프 감지 — 이 갈래를 멈추고 지금까지의 점수는 그대로 지급',
    tone: 'red',
  });
}

/**
 * Processes events depth-first: an event's consequences resolve before its siblings,
 * so chains read as cause → effect. Effects only return new events; state changes happen
 * in `applyCore`. Loop safety: global resolution cap, depth cap, and per-signature repeat cap.
 */
export function processEvents(
  ctx: GameContext,
  roots: { payload: GameEventPayload; source?: SourceRef; essential?: boolean }[],
): void {
  if (!ctx.chain) throw new Error('processEvents requires an open chain');
  const rules = effectiveRules(ctx);
  const queue: GameEvent[] = roots.map((r) =>
    makeEvent(ctx, { payload: r.payload, source: r.source ?? CORE_SOURCE, essential: r.essential ?? true }, 0),
  );
  while (queue.length) {
    const ev = queue.shift()!;
    const rt = ctx.chain;
    if (!rt) break;
    if (!ev.essential) {
      if (rt.chain.overflow) continue;
      if (rt.chain.resolutions >= rules.maxChainResolutions || ev.depth > rules.maxChainDepth) {
        triggerOverflow(ctx, ev.depth);
        continue;
      }
      if (ev.source.kind !== 'core') {
        const sig = signatureOf(ev);
        const n = (rt.signatureCounts.get(sig) ?? 0) + 1;
        rt.signatureCounts.set(sig, n);
        if (n > rules.loopRepeatLimit) {
          triggerOverflow(ctx, ev.depth);
          continue;
        }
      }
    }
    rt.chain.resolutions++;
    if (ev.announce) {
      pushStep(ctx, { kind: 'effect', depth: ev.depth, title: ev.announce, source: ev.source.label, cardUid: ev.source.cardUid, tone: toneForSource(ev.source) });
    }
    const core = applyCore(ctx, ev);
    describeEvent(ctx, ev);
    const reactions = rt.chain.overflow ? [] : collectReactions(ctx, ev);
    const essentialChildren = !!ev.essential;
    const children: GameEvent[] = [
      ...core.before.map((p) => makeEvent(ctx, { payload: p, source: CORE_SOURCE, essential: essentialChildren }, ev.depth + 1, ev.id)),
      ...reactions.map((c) => makeEvent(ctx, c, ev.depth + 1, ev.id)),
      ...core.after.map((p) => makeEvent(ctx, { payload: p, source: CORE_SOURCE, essential: essentialChildren }, ev.depth + 1, ev.id)),
    ];
    queue.unshift(...children);
  }
}

function toneForSource(src: SourceRef): ChainTone {
  switch (src.kind) {
    case 'talisman':
      return 'gold';
    case 'enhancement':
    case 'joker':
      return 'purple';
    case 'mutation':
      return 'pink';
    case 'evolution':
      return 'cyan';
    case 'stage':
    case 'weather':
      return 'gray';
    default:
      return 'gray';
  }
}

// ------------------------------------------------------------------ core rules

function contributorsFor(jokboId: JokboId, members: string[], setMembers: string[], snapshot: string[], firstTime: boolean): string[] {
  const rule = JOKBO_DEFS[jokboId].rule;
  if (rule.kind === 'count') {
    if (firstTime) return members;
    const before = new Set(snapshot);
    const fresh = members.filter((m) => !before.has(m));
    return fresh.length ? fresh : members.slice(-1);
  }
  return setMembers.length ? setMembers : members;
}

function applyCore(ctx: GameContext, ev: GameEvent): CoreResult {
  const stage = ctx.stage!;
  const run = ctx.run;
  const none: CoreResult = { before: [], after: [] };
  switch (ev.type) {
    case 'CARD_CAPTURED': {
      removeFromZones(stage, ev.cardUid);
      if (!stage.captured.includes(ev.cardUid)) stage.captured.push(ev.cardUid);
      const card = findCard(ctx, ev.cardUid);
      if (card) {
        const id = identityOf(ctx, ev.cardUid);
        if (!id.joker) stage.lastCapturedNonJoker = ev.cardUid;
        if (id.joker && card.jokerForm === 'moon') ensureTemp(stage, ev.cardUid).moonMonth = mostCommonMonth(ctx);
      }
      return {
        before: [],
        after: [
          { type: 'CAPTURE_SCORE', cardUid: ev.cardUid, retrigger: false },
          { type: 'JOKBO_CHECK', triggerCardUid: ev.cardUid },
          { type: 'CAPTURE_RESOLVED', cardUid: ev.cardUid, actionId: ev.actionId },
        ],
      };
    }
    case 'CAPTURE_SCORE': {
      const id = identityOf(ctx, ev.cardUid);
      const breakdown = computeCaptureScore(ctx, {
        kind: 'capture',
        label: id.name,
        subjectUid: ev.cardUid,
        contributorUids: [ev.cardUid],
        memberUids: [ev.cardUid],
        applyGlobal: true,
      });
      return {
        before: [
          {
            type: 'SCORE_ADDED',
            amount: breakdown.total,
            label: ev.retrigger ? `${id.name} (재발동)` : id.name,
            scoreKind: 'capture',
            breakdown,
            cardUid: ev.cardUid,
          },
        ],
        after: [],
      };
    }
    case 'JOKBO_CHECK': {
      const evals = evaluateAllJokbo(capturedProfiles(ctx), jokboEvalRules(ctx), ev.triggerCardUid);
      const out: GameEventPayload[] = [];
      for (const id of ALL_JOKBO) {
        const e = evals[id];
        const led = stage.ledger[id];
        led.members = e.members;
        if (e.points > led.points) {
          const first = led.points === 0;
          const delta = e.points - led.points;
          const contributors = contributorsFor(id, e.members, e.setMembers, led.memberSnapshot, first);
          led.points = e.points;
          led.sets = e.sets;
          led.tierLabel = e.tierLabel;
          led.memberSnapshot = e.members;
          out.push({
            type: first ? 'JOKBO_COMPLETED' : 'JOKBO_INCREMENTED',
            jokboId: id,
            delta,
            points: e.points,
            triggerCardUid: ev.triggerCardUid,
            tierLabel: e.tierLabel,
            contributorUids: contributors,
            sets: e.sets,
          });
        }
      }
      return { before: out, after: [] };
    }
    case 'JOKBO_COMPLETED':
    case 'JOKBO_INCREMENTED': {
      const led = stage.ledger[ev.jokboId];
      if (led.activatedTurn === undefined) led.activatedTurn = stage.turn;
      if (RIBBON_SET_IDS.includes(ev.jokboId) && !stage.activatedRibbonSets.includes(ev.jokboId)) {
        stage.activatedRibbonSets.push(ev.jokboId);
      }
      stage.lastCompletedJokbo = ev.jokboId;
      return {
        before: [],
        after: [
          {
            type: 'JOKBO_TRIGGERED',
            jokboId: ev.jokboId,
            reason: ev.type === 'JOKBO_COMPLETED' ? 'complete' : 'increment',
            tradPoints: ev.delta,
            triggerCardUid: ev.triggerCardUid,
            contributorUids: ev.contributorUids,
            tierLabel: ev.tierLabel,
          },
        ],
      };
    }
    case 'JOKBO_TRIGGERED': {
      const led = stage.ledger[ev.jokboId];
      const breakdown = computeJokboScore(ctx, {
        kind: 'jokbo',
        label: JOKBO_DEFS[ev.jokboId].name,
        jokboId: ev.jokboId,
        reason: ev.reason,
        tradPoints: ev.tradPoints,
        triggerCardUid: ev.triggerCardUid,
        contributorUids: ev.contributorUids,
        memberUids: led.members,
        applyGlobal: true,
      });
      led.triggers++;
      if (ev.reason === 'retrigger') led.retriggers++;
      led.lastScore = breakdown.total;
      led.totalScore += breakdown.total;
      if (ev.reason !== 'retrigger') {
        led.lastTradPoints = ev.tradPoints;
        led.lastContributors = ev.contributorUids;
        led.lastTriggerCard = ev.triggerCardUid;
      }
      stage.turnState.scoredJokbo.push(ev.jokboId);
      run.stats.jokboTriggers[ev.jokboId] = (run.stats.jokboTriggers[ev.jokboId] ?? 0) + 1;
      if (ctx.chain) ctx.chain.chain.triggerCount++;
      const def = JOKBO_DEFS[ev.jokboId];
      return {
        before: [
          {
            type: 'SCORE_ADDED',
            amount: breakdown.total,
            label: ev.reason === 'retrigger' ? `${def.shout} 한 번 더!` : (ev.tierLabel ?? def.shout),
            scoreKind: 'jokbo',
            breakdown,
            jokboId: ev.jokboId,
          },
        ],
        after: [],
      };
    }
    case 'RETRIGGER_REQUESTED': {
      const led = stage.ledger[ev.jokboId];
      if (!led || led.points <= 0 || led.lastTradPoints <= 0) {
        return { before: [{ type: 'MESSAGE', text: `${JOKBO_DEFS[ev.jokboId].name}: 발동한 적 없음 — 불발` }], after: [] };
      }
      stage.retriggersThisStage++;
      stage.counters['turn:retriggers'] = (stage.counters['turn:retriggers'] ?? 0) + 1;
      return {
        before: [
          {
            type: 'JOKBO_TRIGGERED',
            jokboId: ev.jokboId,
            reason: 'retrigger',
            tradPoints: led.lastTradPoints,
            triggerCardUid: led.lastTriggerCard,
            contributorUids: led.lastContributors,
            tierLabel: led.tierLabel,
          },
        ],
        after: [],
      };
    }
    case 'SCORE_ADDED': {
      stage.score += ev.amount;
      if (ctx.chain) {
        ctx.chain.chain.totalScore += ev.amount;
        ctx.chain.chain.scoreEvents++;
      }
      run.stats.highestEventScore = Math.max(run.stats.highestEventScore, ev.amount);
      const drunkEvery = ctx.stageDef?.mechanics.drunkEvery;
      if (drunkEvery && ev.scoreKind !== 'capture') {
        stage.scoredEffects++;
        if (stage.scoredEffects % drunkEvery === 0) {
          stage.drunk++;
          if (stage.drunk >= 3) {
            stage.drunk = 0;
            // a random hand card is soaked: discarded and replaced from the stock (no exchange used)
            const soaked = ctx.rng.pickOrUndefined(stage.hand);
            const fresh = stage.stock[0];
            if (!soaked || !fresh) return { before: [{ type: 'MESSAGE', text: '취기 3! 술잔이 엎어졌지만 젖은 패는 없다' }], after: [] };
            const slot = stage.hand.indexOf(soaked);
            stage.hand.splice(slot, 1, fresh);
            stage.stock.shift();
            stage.discard.push(soaked);
            stage.handOrderSeed++;
            return {
              before: [
                { type: 'MESSAGE', text: `취기 3! ${identityOf(ctx, soaked).name}이(가) 술에 젖어 버려지고 ${identityOf(ctx, fresh).name}을(를) 받았다` },
                { type: 'CARD_DRAWN', cardUid: fresh, reason: 'refill' },
              ],
              after: [],
            };
          }
          return { before: [{ type: 'MESSAGE', text: `취기 +1 (${stage.drunk}/3)` }], after: [] };
        }
      }
      return none;
    }
    case 'BONUS_SCORE': {
      const breakdown = computeBonusScore(ctx, {
        kind: 'bonus',
        label: ev.label,
        baseValue: ev.base,
        subjectUid: ev.cardUid,
        contributorUids: [],
        memberUids: [],
        applyGlobal: ev.applyGlobal,
      });
      return {
        before: [
          {
            type: 'SCORE_ADDED',
            amount: breakdown.total,
            label: ev.label,
            scoreKind: ev.special ? 'special' : 'bonus',
            breakdown,
            cardUid: ev.cardUid,
          },
        ],
        after: [],
      };
    }
    case 'SPECIAL_CAPTURE': {
      const rules = effectiveRules(ctx);
      const base = BALANCE.specialCapture[ev.special] * Math.max(1, ev.count ?? 1);
      const before: GameEventPayload[] = [];
      const after: GameEventPayload[] = [];
      if (base > 0) before.push({ type: 'BONUS_SCORE', base, label: SPECIAL_LABEL[ev.special], applyGlobal: true, special: ev.special });
      const pi = BALANCE.specialPi[ev.special] ?? 0;
      if (pi > 0 && rules.piSteal) after.push({ type: 'PI_STOLEN', amount: pi, special: ev.special });
      const coins = BALANCE.specialCoins[ev.special] ?? 0;
      if (coins > 0) after.push({ type: 'COINS_GAINED', amount: coins });
      // 삼뻑 used to win the hand outright; now it pays a share of the target (smaller on boss stages).
      if (ev.special === 'triplePpeok') after.push({ type: 'CUSTOM', customId: 'ppeokBonus' });
      return { before, after };
    }
    case 'PPEOK': {
      stage.ppeokPiles.push({ month: ev.month, uids: [...ev.cardUids], turn: stage.turn });
      stage.ppeokCount++;
      stage.lastPpeokTurn = stage.turn;
      const special = PPEOK_SPECIAL[ev.kind];
      return { before: [], after: special ? [{ type: 'SPECIAL_CAPTURE', special, month: ev.month }] : [] };
    }
    case 'SHAKE_DECLARED':
      // Every score after the declaration carries the multiplier through the pipeline. The score already
      // on the board is left alone: shaking early is worth more, waiting for a 폭탄 captures more.
      stage.shakeCount++;
      return none;
    case 'PI_STOLEN':
      stage.bonusPi += ev.amount;
      return { before: [], after: [{ type: 'JOKBO_CHECK' }] };
    case 'CARD_UPGRADED': {
      if (ev.scope === 'run') {
        const card = findCard(ctx, ev.cardUid);
        if (card) {
          const from = card.level;
          card.level += ev.levels;
          run.stats.cardsUpgraded++;
          onCardLevelChange(run, card, from, card.level);
        }
      } else {
        ensureTemp(stage, ev.cardUid).levelBonus += ev.levels;
      }
      return none;
    }
    case 'CARD_ENHANCED': {
      const def = ENHANCEMENTS[ev.enhancement];
      if (ev.scope === 'run') {
        const card = findCard(ctx, ev.cardUid);
        if (card) {
          const existing = card.enhancements.find((e) => e.id === ev.enhancement);
          if (existing && def.stackable) existing.stacks++;
          else if (!existing) card.enhancements.push({ id: ev.enhancement, stacks: 1 });
        }
      } else {
        const t = ensureTemp(stage, ev.cardUid);
        const existing = t.enhancements.find((e) => e.id === ev.enhancement);
        if (existing && def.stackable) existing.stacks++;
        else if (!existing) t.enhancements.push({ id: ev.enhancement, stacks: 1 });
      }
      invalidate(ctx, 'sources');
      return none;
    }
    case 'CARD_POWER_GAINED': {
      if (ev.scope === 'run') {
        const card = findCard(ctx, ev.cardUid);
        if (card) card.bonusPower += ev.amount;
      } else {
        ensureTemp(stage, ev.cardUid).powerBonus += ev.amount;
      }
      return none;
    }
    case 'EXCHANGE_GRANTED':
      stage.exchangesLeft = Math.max(0, stage.exchangesLeft + ev.amount);
      return none;
    case 'MULTIPLIER_CHANGED': {
      if (ev.scope === 'global') {
        if (ev.mode === 'add') stage.globalMultAdd += ev.value;
        else stage.globalMultFactor *= ev.value;
      } else if (ev.scope === 'month' && ev.month) {
        stage.monthMult[ev.month] = (stage.monthMult[ev.month] ?? 1) * ev.value;
      } else if (ev.scope === 'jokbo' && ev.jokboId) {
        stage.ledger[ev.jokboId].stageMultAdd += ev.value;
      }
      return none;
    }
    case 'PREVIEW_GRANTED':
      stage.counters['preview:temp'] = Math.max(stage.counters['preview:temp'] ?? 0, ev.count);
      stage.counters['preview:until'] = stage.turn + 1;
      return none;
    case 'COINS_GAINED':
      run.coins = Math.max(0, run.coins + ev.amount);
      stage.coinsEarned += ev.amount;
      if (ev.amount > 0) run.stats.coinsEarned += ev.amount;
      return none;
    case 'FLAG_CHANGED':
      stage.flags[ev.flag] = ev.value;
      return none;
    case 'COUNTER_CHANGED': {
      if (ev.scope === 'stage') stage.counters[ev.counter] = ev.value;
      else {
        const [tid, name] = ev.counter.split(':');
        const t = run.talismans.find((x) => x.id === tid);
        if (t && name) t.counters[name] = ev.value;
      }
      return none;
    }
    case 'PROFILE_COPIED':
      ensureTemp(stage, ev.cardUid).copied = copiedProfileOf(ctx, ev.fromUid);
      return { before: [], after: [{ type: 'JOKBO_CHECK', triggerCardUid: ev.cardUid }] };
    case 'RUN_MODIFIER': {
      const cur = run.modifiers[ev.key];
      run.modifiers[ev.key] = ev.mode === 'add' ? cur + ev.value : cur * ev.value;
      return none;
    }
    case 'CUSTOM': {
      const fn = CUSTOM_CORE[ev.customId];
      return fn ? { before: fn(ctx, ev), after: [] } : none;
    }
    default:
      return none;
  }
}

export const SPECIAL_LABEL: Record<SpecialCaptureKind, string> = {
  jjok: '쪽!',
  ttadak: '따닥!',
  firstTtadak: '첫따닥!',
  sweep: '싹쓸이!',
  stack: '뭉치 획득!',
  ppeokEat: '자뻑 먹기!',
  firstPpeok: '첫뻑!',
  chainPpeok: '연뻑!',
  triplePpeok: '삼뻑!',
  bomb: '폭탄!',
  chongtong: '총통!',
};

const PPEOK_SPECIAL: Record<PpeokKind, SpecialCaptureKind | undefined> = {
  normal: undefined,
  first: 'firstPpeok',
  chain: 'chainPpeok',
  triple: 'triplePpeok',
};

const SHAKE_TITLE: Record<ShakeCause, string> = {
  shake: '흔들기!',
  bomb: '폭탄 = 흔들기',
  chongtong: '총통 = 흔들기',
};

// ------------------------------------------------------------------ visualization

function cardName(ctx: GameContext, uid: string | undefined): string {
  if (!uid || !findCard(ctx, uid)) return '?';
  return identityOf(ctx, uid).name;
}

function fmtMult(n: number): string {
  return `×${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function step(ctx: GameContext, ev: GameEvent, kind: ChainStepKind, title: string, extra: Partial<ChainStep> = {}): void {
  pushStep(ctx, { kind, depth: ev.depth, title, source: ev.source.kind === 'core' ? undefined : ev.source.label, ...extra });
}

function describeEvent(ctx: GameContext, ev: GameEvent): void {
  switch (ev.type) {
    case 'CARD_PLAYED':
      step(ctx, ev, 'play', `${cardName(ctx, ev.cardUid)} 냄`, { cardUid: ev.cardUid, tone: 'gray' });
      break;
    case 'STOCK_REVEALED':
      step(ctx, ev, 'reveal', `더미: ${cardName(ctx, ev.cardUid)}`, { cardUid: ev.cardUid, tone: 'gray' });
      break;
    case 'CARD_PLACED':
      step(ctx, ev, 'place', `${cardName(ctx, ev.cardUid)} → 필드`, { cardUid: ev.cardUid, tone: 'gray' });
      break;
    case 'JOKER_REVEALED':
      step(ctx, ev, 'special', '조커! 바로 획득하고 한 장 더', { cardUid: ev.cardUid, tone: 'purple' });
      break;
    case 'EXCHANGE_USED':
      step(ctx, ev, 'exchange', `교환: ${cardName(ctx, ev.discardedUid)} → ${cardName(ctx, ev.drawnUid)}`, {
        cardUid: ev.drawnUid,
        detail: ev.free ? '무료 교환' : undefined,
        tone: 'cyan',
      });
      break;
    case 'JOKBO_COMPLETED': {
      const def = JOKBO_DEFS[ev.jokboId];
      step(ctx, ev, 'jokbo', `${ev.tierLabel ?? def.shout} 완성!`, {
        jokboId: ev.jokboId,
        detail: `${def.name} ${ev.points}점${ev.sets > 1 ? ` · ${ev.sets}세트` : ''}`,
        cardUid: ev.triggerCardUid,
        tone: jokboTone(ev.jokboId),
      });
      break;
    }
    case 'JOKBO_INCREMENTED': {
      const def = JOKBO_DEFS[ev.jokboId];
      const setLike = def.rule.kind === 'set' || def.rule.kind === 'fullMonth';
      step(ctx, ev, 'jokbo', setLike ? `${def.shout} ×${ev.sets}` : `${ev.tierLabel ?? def.shout} +${ev.delta}`, {
        jokboId: ev.jokboId,
        detail: `${def.name} ${ev.points}점`,
        cardUid: ev.triggerCardUid,
        tone: jokboTone(ev.jokboId),
      });
      break;
    }
    case 'RETRIGGER_REQUESTED':
      step(ctx, ev, 'retrigger', `${JOKBO_DEFS[ev.jokboId].shout} 재발동`, { jokboId: ev.jokboId, tone: 'purple' });
      break;
    case 'SCORE_ADDED': {
      const b = ev.breakdown;
      if (ev.scoreKind === 'capture') {
        step(ctx, ev, 'capture', `${ev.label} 획득`, { value: ev.amount, cardUid: ev.cardUid, breakdown: b, tone: 'gray' });
      } else if (ev.scoreKind === 'jokbo' && b) {
        step(ctx, ev, 'score', ev.label, {
          value: ev.amount,
          jokboId: ev.jokboId,
          detail: `(${b.base}+${b.power}${b.flat ? `+${b.flat}` : ''}) ${fmtMult(b.jokboMult)} ${fmtMult(b.globalMult)}`,
          breakdown: b,
          tone: ev.jokboId ? jokboTone(ev.jokboId) : 'gold',
        });
      } else {
        step(ctx, ev, ev.scoreKind === 'special' ? 'special' : 'score', ev.label, {
          value: ev.amount,
          breakdown: b,
          cardUid: ev.cardUid,
          tone: ev.scoreKind === 'special' ? 'green' : 'gold',
        });
      }
      break;
    }
    case 'CARD_UPGRADED':
      step(ctx, ev, 'upgrade', `${cardName(ctx, ev.cardUid)} Lv +${ev.levels}${ev.scope === 'stage' ? ' (임시)' : ''}`, { cardUid: ev.cardUid, tone: 'green' });
      break;
    case 'CARD_ENHANCED':
      step(ctx, ev, 'upgrade', `${cardName(ctx, ev.cardUid)}: ${ENHANCEMENTS[ev.enhancement].name}${ev.scope === 'stage' ? ' (임시)' : ''}`, {
        cardUid: ev.cardUid,
        tone: 'purple',
      });
      break;
    case 'CARD_POWER_GAINED':
      step(ctx, ev, 'upgrade', `${cardName(ctx, ev.cardUid)} 파워 ${ev.amount > 0 ? '+' : ''}${ev.amount}`, { cardUid: ev.cardUid, tone: 'green' });
      break;
    case 'EXCHANGE_GRANTED':
      step(ctx, ev, 'effect', `교환 ${ev.amount > 0 ? '+' : ''}${ev.amount}`, { tone: 'cyan' });
      break;
    case 'MULTIPLIER_CHANGED': {
      let title = '';
      if (ev.scope === 'global') title = ev.mode === 'add' ? `전체 배율 +${ev.value.toFixed(2)}` : `전체 배율 ×${ev.value}`;
      else if (ev.scope === 'month') title = `${ev.month}월 ×${ev.value}`;
      else if (ev.jokboId) title = `${JOKBO_DEFS[ev.jokboId].name} 배율 +${ev.value.toFixed(2)}`;
      step(ctx, ev, 'mult', title, { jokboId: ev.jokboId, tone: 'gold' });
      break;
    }
    case 'PREVIEW_GRANTED':
      step(ctx, ev, 'info', `더미 ${ev.count}장 미리보기`, { tone: 'cyan' });
      break;
    case 'COINS_GAINED':
      step(ctx, ev, 'coins', `엽전 ${ev.amount > 0 ? '+' : ''}${ev.amount}`, { tone: 'gold' });
      break;
    case 'PROFILE_COPIED':
      step(ctx, ev, 'effect', `${cardName(ctx, ev.cardUid)} ← ${cardName(ctx, ev.fromUid)} 복사`, { cardUid: ev.cardUid, tone: 'pink' });
      break;
    case 'MESSAGE':
      step(ctx, ev, 'info', ev.text, { tone: 'gray' });
      break;
    case 'CUSTOM':
      if (ev.text && ev.customId !== 'setWeather') step(ctx, ev, 'info', ev.text, { cardUid: ev.cardUid, tone: 'gray' });
      break;
    case 'SPECIAL_CAPTURE':
      // specials with a score show up through their SCORE_ADDED; the 엽전-only ones get their own shout
      if (BALANCE.specialCapture[ev.special] <= 0) step(ctx, ev, 'special', SPECIAL_LABEL[ev.special], { tone: 'gold' });
      break;
    case 'PPEOK': {
      const stage = ctx.stage!;
      step(ctx, ev, 'special', '뻑!', {
        detail: `${ev.month}월 세 장이 바닥에 묶였다 — 네 번째 ${ev.month}월 패로 한꺼번에 먹을 수 있음 (이번 판 ${stage.ppeokCount}뻑)`,
        cardUid: ev.cardUids[ev.cardUids.length - 1],
        tone: 'red',
      });
      break;
    }
    case 'SHAKE_DECLARED': {
      const stacks = ctx.stage!.shakeCount;
      const capped = stacks > BALANCE.shakeMaxStacks;
      step(ctx, ev, 'mult', ev.cause === 'shake' && ev.month ? `${SHAKE_TITLE.shake} ${ev.month}월` : SHAKE_TITLE[ev.cause], {
        detail: capped
          ? `흔들기는 ${BALANCE.shakeMaxStacks}번까지만 배율이 붙음 — 지금 ×${fmtNum(shakeFactor(stacks))}`
          : `이제부터 얻는 점수 ×${fmtNum(shakeFactor(stacks))} (${stacks}회)`,
        tone: 'pink',
      });
      break;
    }
    case 'PI_STOLEN':
      step(ctx, ev, 'special', `피 +${ev.amount} 뺏기`, { detail: `피 족보에 더해짐 (뺏은 피 ${ctx.stage!.bonusPi})`, tone: 'green' });
      break;
    default:
      break;
  }
}

export function jokboTone(id: JokboId): ChainTone {
  switch (id) {
    case 'hongdan':
      return 'red';
    case 'cheongdan':
      return 'blue';
    case 'chodan':
      return 'green';
    case 'gwang':
      return 'gold';
    case 'godori':
    case 'animal':
      return 'cyan';
    case 'ribbon':
      return 'purple';
    case 'pi':
      return 'green';
    case 'fullMonth':
      return 'pink';
  }
}
