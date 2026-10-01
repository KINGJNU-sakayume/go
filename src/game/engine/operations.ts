import type {
  CardCategory,
  CardFilter,
  CardInstance,
  EnhancementId,
  JokboId,
  JokerFormId,
  Month,
  MutationId,
  MutationInstance,
  OperationChoice,
  OperationInput,
  OutcomeStep,
  PendingOperation,
  Rarity,
  RibbonType,
  RunState,
} from '../types';
import { ALL_JOKBO, ALL_MONTHS } from '../types';
import { BALANCE } from '../config/balance';
import { Rng, deriveRng } from '../rng/rng';
import { MONTH_INFO, RIBBON_INFO, STANDARD_CARDS, defsOfMonth, getCardDef } from '../cards/definitions';
import { cloneBase, clonePerfect, makeCard, uidFor } from '../cards/deck';
import { ENHANCEMENTS, POSITIVE_ENHANCEMENTS } from '../cards/enhancements';
import { MUTATIONS, NEGATIVE_MUTATIONS } from '../cards/mutations';
import { ALL_JOKER_FORMS, JOKER_FORMS } from '../cards/jokers';
import { CATEGORY_KO } from '../cards/identity';
import { identityOf, makeContext, mostCommonMonth, type GameContext } from '../effects/context';
import { matchesFilter } from '../effects/evaluate';
import { hasTalisman, type ActiveSource } from '../effects/sources';
import { JOKBO_DEFS } from '../jokbo/definitions';
import { evolutionsFor, getEvolution } from '../jokbo/evolutions';
import { allTalismans, getTalismanDef } from '../talismans/registry';
import { onCardLevelChange, onJokboLevelChange, pushOp } from './levelups';
import { emitRunEvent } from './runEvents';
import { cloneRun } from './stage';

const DUMMY_SOURCE: ActiveSource = { key: 'op', ref: { kind: 'core', id: 'op', label: '조작' }, specs: [], repeat: 1 };

function runCtx(run: RunState, rng?: Rng): GameContext {
  return makeContext(run, undefined, rng ?? deriveRng(run.seed, 'ctx'));
}

function opRng(run: RunState, op: PendingOperation, ...parts: (string | number)[]): Rng {
  return deriveRng(run.seed, 'op', op.id, op.kind, ...parts);
}

export function filterCards(run: RunState, filter?: CardFilter): string[] {
  const ctx = runCtx(run);
  if (!filter) return run.deck.map((c) => c.uid);
  return run.deck.filter((c) => matchesFilter({ ctx, source: DUMMY_SOURCE }, c.uid, filter)).map((c) => c.uid);
}

function card(run: RunState, uid: string): CardInstance {
  const c = run.deck.find((x) => x.uid === uid);
  if (!c) throw new Error(`Card ${uid} not in deck`);
  return c;
}

function isJoker(c: CardInstance): boolean {
  return getCardDef(c.defId).category === 'joker';
}

export function cardName(run: RunState, uid: string): string {
  return identityOf(runCtx(run), uid).name;
}

// ------------------------------------------------------------------ deck mutations

export function addCard(
  run: RunState,
  defId: string,
  opts: Parameters<typeof makeCard>[2] = {},
): CardInstance {
  const c = makeCard(defId, uidFor(run.nextUid++), { origin: 'reward', ...opts });
  run.deck.push(c);
  run.stats.cardsAdded++;
  return c;
}

export function canRemove(run: RunState, count = 1): boolean {
  return run.deck.length - count >= run.rules.minDeckSize;
}

export function removeCardFromDeck(run: RunState, uid: string, sacrifice = false): string[] {
  const c = card(run, uid);
  const msgs: string[] = [];
  const name = cardName(run, uid);
  run.deck = run.deck.filter((x) => x.uid !== uid);
  run.stats.cardsRemoved++;
  msgs.push(`${name} ${sacrifice ? '희생' : '제거'}`);
  const rng = deriveRng(run.seed, 'remove', uid, run.stats.cardsRemoved);
  if (c.enhancements.some((e) => e.id === 'hollow')) {
    const mult = hasTalisman(runCtx(run), 'scarecrow') ? 2 : 1;
    run.coins += BALANCE.hollowRemovalCoins * mult;
    msgs.push(`공허: 엽전 +${BALANCE.hollowRemovalCoins * mult}`);
    for (let i = 0; i < mult; i++) {
      const target = rng.pickOrUndefined(run.deck.filter((x) => !isJoker(x)));
      if (target) {
        const from = target.level;
        target.level++;
        onCardLevelChange(run, target, from, target.level);
        msgs.push(`공허: ${cardName(run, target.uid)} Lv+1`);
      }
    }
  }
  if (c.mutations.some((m) => m.id === 'rebirth')) {
    const enh = rng.pick(POSITIVE_ENHANCEMENTS.filter((e) => e !== 'dualMonth' && e !== 'hollow'));
    const reborn = addCard(run, c.defId, {
      origin: 'rebirth',
      level: c.level + 2,
      enhancements: [...c.enhancements.filter((e) => e.id !== 'hollow'), { id: enh, stacks: 1 }],
      mutations: c.mutations.filter((m) => m.id !== 'rebirth'),
      jokerForm: c.jokerForm,
      bonusPower: c.bonusPower,
      permanentTags: [...c.permanentTags, 'reborn'],
    });
    run.stats.cardsAdded--;
    msgs.push(`환생: ${cardName(run, reborn.uid)} Lv.${reborn.level} (+${ENHANCEMENTS[enh].name})`);
  }
  msgs.push(...emitRunEvent(run, { type: 'CARD_REMOVED', cardUid: uid, defId: c.defId }));
  return msgs;
}

function duplicate(run: RunState, uid: string, exact: boolean): CardInstance {
  const src = card(run, uid);
  const copy = exact ? clonePerfect(src, uidFor(run.nextUid++)) : cloneBase(src, uidFor(run.nextUid++));
  run.deck.push(copy);
  run.stats.cardsDuplicated++;
  emitRunEvent(run, { type: 'CARD_DUPLICATED', cardUid: uid, newUid: copy.uid });
  return copy;
}

function upgrade(run: RunState, uid: string, levels: number): void {
  const c = card(run, uid);
  const from = c.level;
  c.level += levels;
  run.stats.cardsUpgraded++;
  onCardLevelChange(run, c, from, c.level);
}

export function addEnhancement(c: CardInstance, id: EnhancementId, month?: Month): void {
  const def = ENHANCEMENTS[id];
  const existing = c.enhancements.find((e) => e.id === id);
  if (existing) {
    if (def.stackable) existing.stacks++;
    else if (month) existing.month = month;
    return;
  }
  c.enhancements.push({ id, stacks: 1, month });
}

/** Mutations that replace an existing mutation of the same id instead of stacking. */
const REPLACING: MutationId[] = ['monthShift', 'ribbonDye', 'typeGraft', 'splitMoon', 'tripleMoon', 'piCompression'];

export function addMutation(run: RunState, c: CardInstance, m: MutationInstance): void {
  if (REPLACING.includes(m.id) && m.id !== 'typeGraft') {
    c.mutations = c.mutations.filter((x) => x.id !== m.id);
  }
  if (m.id === 'typeGraft' && c.mutations.some((x) => x.id === 'typeGraft' && x.category === m.category)) return;
  if (!REPLACING.includes(m.id) && c.mutations.some((x) => x.id === m.id)) return;
  c.mutations.push(m);
  run.stats.cardsMutated++;
}

// ------------------------------------------------------------------ candidates

function nonJokerFilter(filter?: CardFilter): CardFilter {
  return { ...(filter ?? {}), joker: false };
}

export function opCandidates(run: RunState, op: PendingOperation): string[] {
  if (op.cardUid) return run.deck.some((c) => c.uid === op.cardUid) ? [op.cardUid] : [];
  const ctx = runCtx(run);
  let pool: string[];
  switch (op.kind) {
    case 'removeCard':
      pool = canRemove(run, op.count) ? filterCards(run, op.filter) : [];
      break;
    case 'enhanceCard': {
      const enh = op.enhancement!;
      const monthBased = enh === 'dualMonth' || enh === 'adjacentMonth' || enh === 'wildMonth';
      pool = filterCards(run, monthBased ? nonJokerFilter(op.filter) : op.filter).filter((u) => {
        const c = card(run, u);
        return ENHANCEMENTS[enh].stackable || !c.enhancements.some((e) => e.id === enh);
      });
      break;
    }
    case 'mutateCard':
    case 'monthShift':
    case 'typeGraft':
    case 'splitMoon':
    case 'ancientCard':
      pool = filterCards(run, nonJokerFilter(op.filter));
      break;
    case 'ribbonDye':
      pool = filterCards(run, nonJokerFilter({ ...(op.filter ?? {}), categories: ['ribbon'] }));
      break;
    case 'purify':
      pool = filterCards(run, op.filter).filter((u) => identityOf(ctx, u).negative);
      break;
    case 'jokerWorkshop':
      pool = filterCards(run, { ...(op.filter ?? {}), joker: true });
      break;
    case 'gambleCard':
      pool = filterCards(run, { ...(op.filter ?? {}), enhanced: true });
      break;
    case 'upgradeJokbo':
    case 'chooseEvolution':
    case 'discoverMonth':
      pool = [];
      break;
    default:
      pool = filterCards(run, op.filter);
  }
  return pool;
}

export function opNeedsCard(op: PendingOperation): boolean {
  return !['upgradeJokbo', 'chooseEvolution', 'discoverMonth'].includes(op.kind);
}

// ------------------------------------------------------------------ choices

const RARITY_WEIGHT: Record<Rarity, number> = { common: 3, uncommon: 2, rare: 1, mythic: 0.4 };

function pickWeightedDistinct<T>(rng: Rng, items: { item: T; weight: number; key: string }[], n: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  const keys = new Set<string>();
  while (out.length < n && pool.length) {
    const it = rng.weighted(pool.map((p) => ({ item: p, weight: p.weight })));
    pool.splice(pool.indexOf(it), 1);
    if (keys.has(it.key)) continue;
    keys.add(it.key);
    out.push(it.item);
  }
  return out;
}

function neighbor(m: Month, exclude: Month[]): Month {
  for (const d of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6]) {
    const x = (((m - 1 + d + 120) % 12) + 1) as Month;
    if (!exclude.includes(x)) return x;
  }
  return m;
}

const RIBBON_SLOTS: { type: RibbonType; months: Month[] }[] = [
  { type: 'hongdan', months: [1, 2, 3] },
  { type: 'cheongdan', months: [6, 9, 10] },
  { type: 'chodan', months: [4, 5, 7] },
];

export function describeMutationChoice(id: string): { label: string; description: string; rarity: Rarity } {
  const [kind, a, b] = id.split(':');
  const def = MUTATIONS[kind as MutationId];
  switch (kind) {
    case 'monthShift':
      return { label: `${def.name} → ${a}월`, description: `인쇄된 달을 ${a}월(${MONTH_INFO[Number(a) as Month].plantKo})로 바꿈.`, rarity: def.rarity };
    case 'splitMoon':
      return { label: `${def.name} +${a}월`, description: `${a}월을 두 번째 달로 추가 (매칭 + 점수).`, rarity: def.rarity };
    case 'tripleMoon':
      return { label: `${def.name} +${a.split(',').join('·')}월`, description: `${a.split(',').join('·')}월을 추가해 세 달로 취급.`, rarity: def.rarity };
    case 'typeGraft':
      return { label: `${def.name}: ${CATEGORY_KO[a as CardCategory]}`, description: `${CATEGORY_KO[a as CardCategory]} 종류를 추가로 가짐.`, rarity: def.rarity };
    case 'ribbonDye':
      return {
        label: `${def.name} → ${b}월 ${RIBBON_INFO[a as RibbonType].nameKo}`,
        description: `이 띠가 ${b}월 ${RIBBON_INFO[a as RibbonType].nameKo}로 바뀜 (달도 함께 바뀜).`,
        rarity: def.rarity,
      };
    default:
      return { label: def?.name ?? id, description: def?.description ?? '', rarity: def?.rarity ?? 'common' };
  }
}

export function parseMutationChoice(id: string): MutationInstance {
  const [kind, a, b] = id.split(':');
  switch (kind) {
    case 'monthShift':
      return { id: 'monthShift', month: Number(a) as Month };
    case 'splitMoon':
      return { id: 'splitMoon', month: Number(a) as Month };
    case 'tripleMoon':
      return { id: 'tripleMoon', months: a.split(',').map((x) => Number(x) as Month) };
    case 'typeGraft':
      return { id: 'typeGraft', category: a as CardCategory };
    case 'ribbonDye':
      return { id: 'ribbonDye', ribbonType: a as RibbonType, month: Number(b) as Month };
    case 'piCompression':
      return { id: 'piCompression', amount: 2 };
    default:
      return { id: kind as MutationId };
  }
}

export function mutationOptionIds(run: RunState, uid: string, rng: Rng, n = 3): string[] {
  const ctx = runCtx(run);
  const id = identityOf(ctx, uid);
  const mcm = mostCommonMonth(ctx);
  const months = id.scoringMonths;
  const printed = id.printedMonth ?? 1;
  const items: { item: string; weight: number; key: string }[] = [];
  const shiftTo = mcm !== printed ? mcm : neighbor(printed, [printed]);
  items.push({ item: `monthShift:${shiftTo}`, weight: 3, key: 'monthShift' });
  const splitTo = !months.includes(mcm) ? mcm : neighbor(printed, months);
  items.push({ item: `splitMoon:${splitTo}`, weight: 2, key: 'splitMoon' });
  if (!id.mutations.some((m) => m.id === 'tripleMoon')) {
    const a = splitTo;
    const b = neighbor(a, [...months, a]);
    items.push({ item: `tripleMoon:${a},${b}`, weight: 0.6, key: 'tripleMoon' });
  }
  for (const cat of ['animal', 'ribbon', 'pi'] as CardCategory[]) {
    if (!id.categories.includes(cat)) items.push({ item: `typeGraft:${cat}`, weight: 0.8, key: `typeGraft:${cat}` });
  }
  if (id.ribbon) {
    const targets = RIBBON_SLOTS.flatMap((s) => s.months.map((m) => ({ type: s.type, month: m }))).filter(
      (t) => !(t.type === id.ribbonType && t.month === printed),
    );
    const t = rng.pick(targets);
    items.push({ item: `ribbonDye:${t.type}:${t.month}`, weight: 2.5, key: 'ribbonDye' });
  }
  if (id.level >= 4 && !id.bright) items.push({ item: 'brightAscension', weight: 1.5, key: 'brightAscension' });
  if (!id.mutations.some((m) => m.id === 'piCompression')) items.push({ item: 'piCompression', weight: 1.5, key: 'piCompression' });
  for (const m of ['mirror', 'parasite', 'rebirth'] as MutationId[]) {
    if (!id.mutations.some((x) => x.id === m)) items.push({ item: m, weight: 1, key: m });
  }
  if (id.def.rainBright && !id.mutations.some((m) => m.id === 'clearSky')) items.push({ item: 'clearSky', weight: 2, key: 'clearSky' });
  return pickWeightedDistinct(rng, items, n);
}

function enhancementOptionIds(run: RunState, uid: string, rng: Rng, n: number, rarityBoost = 0): string[] {
  const ctx = runCtx(run);
  const id = identityOf(ctx, uid);
  const items: { item: string; weight: number; key: string }[] = [];
  for (const e of POSITIVE_ENHANCEMENTS) {
    const def = ENHANCEMENTS[e];
    if (!def.stackable && id.card.enhancements.some((x) => x.id === e)) continue;
    if (id.joker && (e === 'dualMonth' || e === 'adjacentMonth' || e === 'wildMonth')) continue;
    let item: string = e;
    if (e === 'dualMonth') {
      const mcm = mostCommonMonth(ctx);
      const m = !id.scoringMonths.includes(mcm) ? mcm : neighbor(id.printedMonth ?? 1, id.scoringMonths);
      item = `dualMonth:${m}`;
    }
    const w = RARITY_WEIGHT[def.rarity] + (def.rarity === 'rare' ? rarityBoost : 0);
    items.push({ item, weight: w, key: e });
  }
  return pickWeightedDistinct(rng, items, n);
}

export function describeEnhancementChoice(id: string): { label: string; description: string; rarity: Rarity } {
  const [e, m] = id.split(':');
  const def = ENHANCEMENTS[e as EnhancementId];
  if (e === 'dualMonth' && m) return { label: `${def.name} (${m}월)`, description: `${m}월과도 짝을 맞춤 (매칭 전용).`, rarity: def.rarity };
  return { label: def.name, description: def.description, rarity: def.rarity };
}

export function opChoices(run: RunState, op: PendingOperation, cardUid?: string): OperationChoice[] {
  const uid = op.cardUid ?? cardUid;
  switch (op.kind) {
    case 'mutateCard': {
      if (!uid) return [];
      return mutationOptionIds(run, uid, opRng(run, op, uid)).map((id) => ({ id, ...describeMutationChoice(id) }));
    }
    case 'levelEnhancement': {
      if (!uid) return [];
      return enhancementOptionIds(run, uid, opRng(run, op, uid), 3).map((id) => ({ id, ...describeEnhancementChoice(id) }));
    }
    case 'specialUpgrade': {
      if (!uid) return [];
      const rng = opRng(run, op, uid);
      const enh = enhancementOptionIds(run, uid, rng, 2, 1.5).map((id) => ({ id: `enh:${id}`, ...describeEnhancementChoice(id) }));
      const isJ = isJoker(card(run, uid));
      const mut = isJ ? [] : mutationOptionIds(run, uid, rng, 1).map((id) => ({ id: `mut:${id}`, ...describeMutationChoice(id) }));
      return [...enh, ...mut];
    }
    case 'monthShift':
    case 'splitMoon': {
      if (!uid) return [];
      const id = identityOf(runCtx(run), uid);
      return ALL_MONTHS.filter((m) => (op.kind === 'monthShift' ? m !== id.printedMonth : !id.scoringMonths.includes(m))).map((m) => ({
        id: `m${m}`,
        label: `${m}월 ${MONTH_INFO[m].plantKo}`,
        description: op.kind === 'monthShift' ? `${m}월로 바꿈` : `${m}월 추가`,
      }));
    }
    case 'ribbonDye': {
      if (!uid) return [];
      const id = identityOf(runCtx(run), uid);
      return RIBBON_SLOTS.flatMap((s) =>
        s.months
          .filter((m) => !(s.type === id.ribbonType && m === id.printedMonth))
          .map((m) => ({
            id: `ribbonDye:${s.type}:${m}`,
            label: `${m}월 ${RIBBON_INFO[s.type].nameKo}`,
            description: `${RIBBON_INFO[s.type].nameKo} 세트의 ${m}월 칸을 채우는 띠가 됨`,
          })),
      );
    }
    case 'typeGraft': {
      if (!uid) return [];
      const id = identityOf(runCtx(run), uid);
      return (['animal', 'ribbon', 'pi'] as CardCategory[])
        .filter((c) => !id.categories.includes(c))
        .map((c) => ({ id: c, label: CATEGORY_KO[c], description: `${CATEGORY_KO[c]} 종류 추가` }));
    }
    case 'jokerWorkshop': {
      if (!uid) return [];
      const current = card(run, uid).jokerForm;
      const rng = opRng(run, op, uid);
      const items = ALL_JOKER_FORMS.filter((f) => f !== current && f !== 'service').map((f) => ({
        item: f,
        weight: RARITY_WEIGHT[JOKER_FORMS[f].rarity],
        key: f,
      }));
      return pickWeightedDistinct(rng, items, 3).map((f: JokerFormId) => ({
        id: f,
        label: JOKER_FORMS[f].name,
        description: JOKER_FORMS[f].description,
        rarity: JOKER_FORMS[f].rarity,
      }));
    }
    case 'chooseEvolution': {
      const jid = op.jokboId!;
      const owned = new Set(run.jokbo[jid].evolutions);
      return evolutionsFor(jid)
        .filter((e) => !owned.has(e.id))
        .map((e) => ({ id: e.id, label: `${e.name} (${e.nameEn})`, description: e.description, rarity: 'rare' as Rarity }));
    }
    case 'upgradeJokbo':
      return ALL_JOKBO.map((j) => {
        const lv = run.jokbo[j].level;
        return {
          id: j,
          label: `${JOKBO_DEFS[j].name} Lv.${lv} → Lv.${lv + (op.levels ?? 1)}`,
          description: `×${BALANCE.jokboLevelMult(lv).toFixed(2)} → ×${BALANCE.jokboLevelMult(lv + (op.levels ?? 1)).toFixed(2)}`,
        };
      });
    case 'discoverMonth':
      return ALL_MONTHS.map((m) => ({ id: `m${m}`, label: `${m}월 ${MONTH_INFO[m].plantKo}`, description: `${m}월 카드 무작위 1장 추가` }));
    case 'enhanceCard':
      if (op.enhancement === 'dualMonth' && uid) {
        const id = identityOf(runCtx(run), uid);
        return ALL_MONTHS.filter((m) => !id.scoringMonths.includes(m)).map((m) => ({
          id: `m${m}`,
          label: `${m}월과 짝`,
          description: `두 번째 매칭 달: ${m}월`,
        }));
      }
      return [];
    default:
      return [];
  }
}

/** Does this operation need a sub-choice after a card is picked? */
export function opNeedsChoice(op: PendingOperation): boolean {
  return (
    [
      'mutateCard',
      'levelEnhancement',
      'specialUpgrade',
      'monthShift',
      'splitMoon',
      'ribbonDye',
      'typeGraft',
      'jokerWorkshop',
      'chooseEvolution',
      'upgradeJokbo',
      'discoverMonth',
    ].includes(op.kind) ||
    (op.kind === 'enhanceCard' && op.enhancement === 'dualMonth')
  );
}

function monthFromChoice(choiceId?: string, month?: Month): Month {
  if (month) return month;
  if (choiceId?.startsWith('m')) return Number(choiceId.slice(1)) as Month;
  throw new Error('Month choice required');
}

// ------------------------------------------------------------------ resolution

function applyOperation(run: RunState, op: PendingOperation, input: OperationInput): string[] {
  const msgs: string[] = [];
  const uids = input.cardUids ?? (op.cardUid ? [op.cardUid] : []);
  const needCards = opNeedsCard(op) ? Math.max(1, op.count) : 0;
  if (needCards && uids.length !== needCards) throw new Error(`Pick ${needCards} card(s)`);
  const eligible = new Set(opCandidates(run, op));
  for (const u of uids) if (!eligible.has(u)) throw new Error(`Card ${u} is not eligible`);
  const uid = uids[0];

  switch (op.kind) {
    case 'removeCard': {
      if (!canRemove(run, uids.length)) throw new Error(`덱은 최소 ${run.rules.minDeckSize}장이어야 함`);
      for (const u of uids) {
        const wasPi = identityOf(runCtx(run), u).categories.includes('pi');
        msgs.push(...removeCardFromDeck(run, u, !!op.sacrifice));
        if (op.source === 'shop') {
          run.removals++;
          if (wasPi && run.shop && !run.shop.piRemovalDiscountUsed && hasTalisman(runCtx(run), 'weeding')) {
            run.shop.piRemovalDiscountUsed = true;
            if (op.refund) {
              run.coins += op.refund;
              msgs.push(`잡초 뽑기: 엽전 ${op.refund} 환불`);
            }
          }
        }
      }
      break;
    }
    case 'upgradeCard': {
      const before = card(run, uid).level;
      upgrade(run, uid, op.levels ?? 1);
      if (op.addEnhancement) addEnhancement(card(run, uid), op.addEnhancement);
      msgs.push(`${cardName(run, uid)} Lv.${before} → Lv.${card(run, uid).level}`);
      break;
    }
    case 'duplicateCard':
    case 'perfectClone': {
      const copy = duplicate(run, uid, op.kind === 'perfectClone');
      msgs.push(`${cardName(run, copy.uid)} 복제 (${op.kind === 'perfectClone' ? '완전 복제' : '기본 복제'})`);
      break;
    }
    case 'enhanceCard': {
      const enh = op.enhancement!;
      const month = enh === 'dualMonth' ? monthFromChoice(input.choiceId, input.month) : undefined;
      addEnhancement(card(run, uid), enh, month);
      msgs.push(`${cardName(run, uid)}: ${ENHANCEMENTS[enh].name}`);
      break;
    }
    case 'levelEnhancement': {
      if (!input.choiceId) throw new Error('Choice required');
      const [e, m] = input.choiceId.split(':');
      addEnhancement(card(run, uid), e as EnhancementId, m ? (Number(m) as Month) : undefined);
      msgs.push(`${cardName(run, uid)}: ${ENHANCEMENTS[e as EnhancementId].name}`);
      break;
    }
    case 'specialUpgrade': {
      if (!input.choiceId) throw new Error('Choice required');
      const [kind, ...rest] = input.choiceId.split(':');
      const payload = rest.join(':');
      if (kind === 'enh') {
        const [e, m] = payload.split(':');
        addEnhancement(card(run, uid), e as EnhancementId, m ? (Number(m) as Month) : undefined);
        msgs.push(`${cardName(run, uid)}: ${ENHANCEMENTS[e as EnhancementId].name}`);
      } else {
        addMutation(run, card(run, uid), parseMutationChoice(payload));
        msgs.push(`${cardName(run, uid)}: ${describeMutationChoice(payload).label}`);
      }
      break;
    }
    case 'mutateCard': {
      if (!input.choiceId) throw new Error('Choice required');
      const valid = opChoices(run, op, uid).some((c) => c.id === input.choiceId);
      if (!valid) throw new Error('Invalid mutation choice');
      addMutation(run, card(run, uid), parseMutationChoice(input.choiceId));
      msgs.push(`${cardName(run, uid)}: ${describeMutationChoice(input.choiceId).label}`);
      break;
    }
    case 'monthShift': {
      const m = monthFromChoice(input.choiceId, input.month);
      addMutation(run, card(run, uid), { id: 'monthShift', month: m });
      msgs.push(`${cardName(run, uid)} → ${m}월`);
      break;
    }
    case 'splitMoon': {
      const m = monthFromChoice(input.choiceId, input.month);
      addMutation(run, card(run, uid), { id: 'splitMoon', month: m });
      msgs.push(`${cardName(run, uid)} +${m}월`);
      break;
    }
    case 'ribbonDye': {
      if (!input.choiceId) throw new Error('Choice required');
      addMutation(run, card(run, uid), parseMutationChoice(input.choiceId));
      msgs.push(`${cardName(run, uid)} 염색 완료`);
      break;
    }
    case 'typeGraft': {
      const cat = (input.category ?? input.choiceId) as CardCategory;
      if (!cat) throw new Error('Category required');
      addMutation(run, card(run, uid), { id: 'typeGraft', category: cat });
      msgs.push(`${cardName(run, uid)} + ${CATEGORY_KO[cat]}`);
      break;
    }
    case 'purify': {
      const c = card(run, uid);
      const neg = c.mutations.findIndex((m) => MUTATIONS[m.id].negative);
      if (neg >= 0) {
        msgs.push(`${MUTATIONS[c.mutations[neg].id].name} 정화`);
        c.mutations.splice(neg, 1);
      } else {
        const cursed = c.enhancements.findIndex((e) => e.id === 'cursed');
        if (cursed >= 0) {
          c.enhancements.splice(cursed, 1);
          msgs.push('저주 정화');
        }
      }
      break;
    }
    case 'jokerWorkshop': {
      const form = input.choiceId as JokerFormId;
      if (!form || !JOKER_FORMS[form]) throw new Error('Form required');
      card(run, uid).jokerForm = form;
      msgs.push(`조커 → ${JOKER_FORMS[form].name}`);
      break;
    }
    case 'upgradeJokbo': {
      const j = (input.jokboId ?? op.jokboId ?? input.choiceId) as JokboId;
      if (!j || !run.jokbo[j]) throw new Error('Jokbo required');
      const from = run.jokbo[j].level;
      run.jokbo[j].level += op.levels ?? 1;
      onJokboLevelChange(run, j, from, run.jokbo[j].level);
      msgs.push(`${JOKBO_DEFS[j].name} Lv.${from} → Lv.${run.jokbo[j].level}`);
      break;
    }
    case 'chooseEvolution': {
      const evo = getEvolution(input.choiceId ?? '');
      if (!evo || evo.jokboId !== op.jokboId) throw new Error('Invalid evolution');
      if (!run.jokbo[evo.jokboId].evolutions.includes(evo.id)) run.jokbo[evo.jokboId].evolutions.push(evo.id);
      msgs.push(`${JOKBO_DEFS[evo.jokboId].name} 진화: ${evo.name}`);
      break;
    }
    case 'gambleCard': {
      const rng = opRng(run, op, uid);
      const chance = op.chance ?? 0.5;
      if (rng.chance(chance)) {
        const copy = duplicate(run, uid, true);
        msgs.push(`승리! ${cardName(run, copy.uid)} 완전 복제`);
      } else {
        const curse = rng.pick(NEGATIVE_MUTATIONS);
        addMutation(run, card(run, uid), { id: curse });
        msgs.push(`패배… ${cardName(run, uid)}에 ${MUTATIONS[curse].name}`);
      }
      break;
    }
    case 'ancientCard': {
      const rng = opRng(run, op, uid);
      const c = card(run, uid);
      const from = c.level;
      c.level += 4;
      c.permanentTags.push('ancient');
      onCardLevelChange(run, c, from, c.level);
      const curse = rng.pick(NEGATIVE_MUTATIONS);
      addMutation(run, c, { id: curse });
      msgs.push(`${cardName(run, uid)}: 고대의 패 Lv.${c.level} (${MUTATIONS[curse].name})`);
      break;
    }
    case 'discoverMonth': {
      const m = monthFromChoice(input.choiceId, input.month);
      const rng = opRng(run, op, m);
      const def = rng.pick(defsOfMonth(m));
      const c = addCard(run, def.id, { origin: 'event' });
      msgs.push(`${cardName(run, c.uid)} 발견`);
      break;
    }
  }
  return msgs;
}

export function resolveOperation(run: RunState, opId: number, input: OperationInput): RunState {
  const next = cloneRun(run);
  const idx = next.ops.findIndex((o) => o.id === opId);
  if (idx < 0) throw new Error(`No pending operation ${opId}`);
  const op = next.ops[idx];
  if (input.cancel) {
    if (!op.cancellable) throw new Error('This choice cannot be skipped');
    next.ops.splice(idx, 1);
    if (op.refund) next.coins += op.refund;
    next.history.push({ stageIndex: next.stageIndex, text: `${op.title}: 취소` });
    return next;
  }
  const msgs = applyOperation(next, op, input);
  next.ops.splice(next.ops.indexOf(op), 1);
  for (const m of msgs) next.history.push({ stageIndex: next.stageIndex, text: m });
  runOutcomes(next, op.then);
  return next;
}

/** Preview: the run as it would be after resolving the operation (nothing is committed). */
export function previewOperation(run: RunState, opId: number, input: OperationInput): RunState | undefined {
  try {
    return resolveOperation(run, opId, input);
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ outcome steps

function outcomeRng(run: RunState, salt: string | number): Rng {
  return deriveRng(run.seed, 'outcome', run.nextOpId, run.deck.length, run.coins, run.talismans.length, salt);
}

export function gainTalisman(run: RunState, id: string): boolean {
  if (!getTalismanDef(id) || run.talismans.some((t) => t.id === id)) return false;
  run.talismans.push({ id, counters: {}, acquiredAt: run.stageIndex });
  run.stats.talismansObtained.push(id);
  return true;
}

export function randomTalismanId(run: RunState, rng: Rng, rarity: Rarity): string | undefined {
  const owned = new Set(run.talismans.map((t) => t.id));
  const pool = allTalismans().filter((t) => !owned.has(t.id));
  const exact = pool.filter((t) => t.rarity === rarity);
  return rng.pickOrUndefined(exact.length ? exact : pool)?.id;
}

export function runOutcomes(run: RunState, steps: OutcomeStep[]): void {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const log = (text: string) => run.history.push({ stageIndex: run.stageIndex, text });
    switch (s.op) {
      case 'interactive': {
        pushOp(run, { ...s.operation, then: steps.slice(i + 1) });
        return;
      }
      case 'gainCoins':
        run.coins += s.amount;
        run.stats.coinsEarned += Math.max(0, s.amount);
        log(`엽전 +${s.amount}`);
        break;
      case 'loseCoins':
        run.coins = Math.max(0, run.coins - s.amount);
        break;
      case 'loseCoinFraction':
        run.coins = Math.max(0, run.coins - Math.floor(run.coins * s.fraction));
        break;
      case 'gainTalisman':
        if (gainTalisman(run, s.talismanId)) log(`부적 획득: ${getTalismanDef(s.talismanId)?.name}`);
        break;
      case 'gainRandomTalisman': {
        const id = randomTalismanId(run, outcomeRng(run, i), s.rarity);
        if (id && gainTalisman(run, id)) log(`부적 획득: ${getTalismanDef(id)?.name}`);
        break;
      }
      case 'upgradeJokboFixed': {
        const p = run.jokbo[s.jokboId];
        const from = p.level;
        p.level += s.levels;
        onJokboLevelChange(run, s.jokboId, from, p.level);
        log(`${JOKBO_DEFS[s.jokboId].name} Lv.${from} → Lv.${p.level}`);
        break;
      }
      case 'addCard': {
        const c = addCard(run, s.defId, {
          level: s.level,
          enhancements: s.enhancements,
          mutations: s.mutations,
          jokerForm: s.jokerForm,
          origin: 'reward',
        });
        log(`${cardName(run, c.uid)} 추가`);
        break;
      }
      case 'addJoker': {
        const c = addCard(run, 'joker', { jokerForm: s.form, origin: 'reward' });
        log(`${cardName(run, c.uid)} 추가`);
        break;
      }
      case 'addCursedCard': {
        const rng = outcomeRng(run, `curse${i}`);
        const def = rng.pick(STANDARD_CARDS);
        const c = addCard(run, def.id, { level: 3, enhancements: [{ id: 'cursed', stacks: 1 }], origin: 'event' });
        log(`저주받은 ${cardName(run, c.uid)} 추가`);
        break;
      }
      case 'cloneCard':
        if (run.deck.some((c) => c.uid === s.uid)) {
          const copy = duplicate(run, s.uid, s.exact);
          log(`${cardName(run, copy.uid)} 복제`);
        }
        break;
      case 'upgradeCards':
        for (const u of s.uids) if (run.deck.some((c) => c.uid === u)) upgrade(run, u, s.levels);
        log(`카드 ${s.uids.length}장 Lv+${s.levels}`);
        break;
      case 'upgradeMatching': {
        const uids = filterCards(run, s.filter);
        for (const u of uids) upgrade(run, u, s.levels);
        log(`카드 ${uids.length}장 Lv+${s.levels}`);
        break;
      }
      case 'removeCards':
        for (const u of s.uids) {
          if (!run.deck.some((c) => c.uid === u) || !canRemove(run, 1)) continue;
          for (const m of removeCardFromDeck(run, u)) log(m);
        }
        break;
      case 'mutateSpecific': {
        const c = run.deck.find((x) => x.uid === s.uid);
        if (c) {
          addMutation(run, c, s.mutation);
          if (s.levels) upgrade(run, c.uid, s.levels);
          log(`${cardName(run, c.uid)}: ${MUTATIONS[s.mutation.id].name}`);
        }
        break;
      }
      case 'runModifier': {
        const cur = run.modifiers[s.key];
        run.modifiers[s.key] = s.mode === 'add' ? cur + s.value : cur * s.value;
        break;
      }
      case 'gamble': {
        const rng = outcomeRng(run, `gamble${i}`);
        const win = rng.chance(s.chance);
        log(`${s.label}: ${win ? '성공!' : '실패…'}`);
        runOutcomes(run, [...(win ? s.win : s.lose), ...steps.slice(i + 1)]);
        return;
      }
      case 'randomRareReward': {
        const rng = outcomeRng(run, `rare${i}`);
        const roll = rng.int(4);
        if (roll === 0) {
          const id = randomTalismanId(run, rng, 'rare');
          if (id && gainTalisman(run, id)) log(`희귀 부적: ${getTalismanDef(id)?.name}`);
        } else if (roll === 1) {
          const best = [...run.deck].sort((a, b) => b.level - a.level)[0];
          if (best) {
            const copy = duplicate(run, best.uid, true);
            log(`완전 복제: ${cardName(run, copy.uid)}`);
          }
        } else if (roll === 2) {
          const j = rng.pick(ALL_JOKBO);
          const from = run.jokbo[j].level;
          run.jokbo[j].level += 2;
          onJokboLevelChange(run, j, from, run.jokbo[j].level);
          log(`${JOKBO_DEFS[j].name} Lv+2`);
        } else {
          const target = rng.pick(run.deck.filter((c) => !isJoker(c)));
          const enh = rng.pick<EnhancementId>(['echo', 'golden', 'catalyst', 'wildMonth']);
          addEnhancement(target, enh);
          log(`${cardName(run, target.uid)}: ${ENHANCEMENTS[enh].name}`);
        }
        break;
      }
      case 'randomCurse': {
        const rng = outcomeRng(run, `rcurse${i}`);
        const target = rng.pickOrUndefined(run.deck.filter((c) => !isJoker(c)));
        if (target) {
          const curse = rng.pick(NEGATIVE_MUTATIONS);
          addMutation(run, target, { id: curse });
          log(`저주: ${cardName(run, target.uid)}에 ${MUTATIONS[curse].name}`);
        }
        break;
      }
      case 'message':
        log(s.text);
        break;
    }
  }
}

export { getCardDef };
