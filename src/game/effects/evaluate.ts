import type {
  CardFilter,
  Condition,
  GameEvent,
  JokboId,
  Month,
  ScalarExpr,
  TriggerReason,
  ValueExpr,
} from '../types';
import { ALL_MONTHS } from '../types';
import { getCardDef } from '../cards/definitions';
import { JOKBO_DEFS } from '../jokbo/definitions';
import type { CardIdentity } from '../cards/identity';
import { findCard, identityOf, mostCommonMonth, viewOf, type GameContext } from './context';
import type { ActiveSource } from './sources';
import { CUSTOM_CONDITIONS } from './customRegistry';

/** What a scoring hook is looking at. */
export interface ScoreScope {
  kind: 'jokbo' | 'capture' | 'bonus';
  label: string;
  jokboId?: JokboId;
  reason?: TriggerReason;
  tradPoints?: number;
  triggerCardUid?: string;
  contributorUids: string[];
  memberUids: string[];
  subjectUid?: string;
  baseValue?: number;
  applyGlobal: boolean;
}

export interface EvalScope {
  ctx: GameContext;
  source: ActiveSource;
  event?: GameEvent;
  subjectUid?: string;
  score?: ScoreScope;
}

export function eventCardUid(event: GameEvent | undefined): string | undefined {
  if (!event) return undefined;
  switch (event.type) {
    case 'CARD_CAPTURED':
    case 'CAPTURE_RESOLVED':
    case 'CARD_DRAWN':
    case 'CARD_PLAYED':
    case 'STOCK_REVEALED':
    case 'CARD_MATCHED':
    case 'CARD_PLACED':
    case 'CAPTURE_SCORE':
    case 'JOKER_REVEALED':
    case 'CARD_UPGRADED':
    case 'CARD_ENHANCED':
    case 'CARD_POWER_GAINED':
    case 'CARD_REMOVED':
    case 'CARD_DUPLICATED':
      return event.cardUid;
    case 'EXCHANGE_USED':
      return event.discardedUid;
    case 'JOKBO_TRIGGERED':
    case 'JOKBO_COMPLETED':
    case 'JOKBO_INCREMENTED':
      return event.triggerCardUid;
    default:
      return undefined;
  }
}

export function scopeSubject(scope: EvalScope): string | undefined {
  return scope.subjectUid ?? scope.score?.subjectUid ?? eventCardUid(scope.event);
}

export function scopeJokbo(scope: EvalScope): JokboId | undefined {
  if (scope.score?.jokboId) return scope.score.jokboId;
  const e = scope.event;
  if (!e) return undefined;
  if (
    e.type === 'JOKBO_TRIGGERED' ||
    e.type === 'JOKBO_COMPLETED' ||
    e.type === 'JOKBO_INCREMENTED' ||
    e.type === 'RETRIGGER_REQUESTED'
  )
    return e.jokboId;
  return undefined;
}

function scopeReason(scope: EvalScope): TriggerReason | undefined {
  if (scope.score?.reason) return scope.score.reason;
  const e = scope.event;
  if (!e) return undefined;
  if (e.type === 'JOKBO_TRIGGERED') return e.reason;
  if (e.type === 'JOKBO_COMPLETED') return 'complete';
  if (e.type === 'JOKBO_INCREMENTED') return 'increment';
  if (e.type === 'RETRIGGER_REQUESTED') return 'retrigger';
  return undefined;
}

function scopeTriggerCard(scope: EvalScope): string | undefined {
  if (scope.score) return scope.score.triggerCardUid;
  const e = scope.event;
  if (!e) return undefined;
  if (e.type === 'JOKBO_TRIGGERED' || e.type === 'JOKBO_COMPLETED' || e.type === 'JOKBO_INCREMENTED')
    return e.triggerCardUid;
  return undefined;
}

function scopeMembers(scope: EvalScope): string[] {
  if (scope.score) return scope.score.memberUids;
  const j = scopeJokbo(scope);
  if (j && scope.ctx.stage) return scope.ctx.stage.ledger[j]?.members ?? [];
  return [];
}

function scopeContributors(scope: EvalScope): string[] {
  if (scope.score) return scope.score.contributorUids;
  const e = scope.event;
  if (e?.type === 'JOKBO_TRIGGERED') return e.contributorUids;
  const j = scopeJokbo(scope);
  if (j && scope.ctx.stage) return scope.ctx.stage.ledger[j]?.lastContributors ?? [];
  return [];
}

// ---------------------------------------------------------------- scalars

function capturedIdentities(ctx: GameContext): CardIdentity[] {
  return (ctx.stage?.captured ?? []).map((uid) => identityOf(ctx, uid));
}

export function duplicatesInDeck(ctx: GameContext): number {
  const counts = new Map<string, number>();
  for (const c of ctx.run.deck) {
    if (getCardDef(c.defId).category === 'joker') continue;
    counts.set(c.defId, (counts.get(c.defId) ?? 0) + 1);
  }
  let dup = 0;
  for (const n of counts.values()) dup += Math.max(0, n - 1);
  return dup;
}

export function monthsMissingFromDeck(ctx: GameContext): number {
  const present = new Set<Month>();
  for (const c of ctx.run.deck) {
    const id = identityOf(ctx, c.uid);
    if (id.joker) continue;
    for (const m of id.scoringMonths) present.add(m);
  }
  return ALL_MONTHS.filter((m) => !present.has(m)).length;
}

export function cardsRemovedFromStart(ctx: GameContext): number {
  const inDeck = new Set(ctx.run.deck.map((c) => c.uid));
  return ctx.run.startingUids.filter((u) => !inDeck.has(u)).length;
}

export function readScalar(scope: EvalScope, scalar: ScalarExpr['scalar'], arg?: string): number {
  const { ctx } = scope;
  const stage = ctx.stage;
  switch (scalar) {
    case 'deckSize':
      return ctx.run.deck.length;
    case 'cardsRemovedFromStart':
      return cardsRemovedFromStart(ctx);
    case 'duplicatesInDeck':
      return duplicatesInDeck(ctx);
    case 'monthsMissingFromDeck':
      return monthsMissingFromDeck(ctx);
    case 'jokersInDeck':
      return ctx.run.deck.filter((c) => getCardDef(c.defId).category === 'joker').length;
    case 'enhancedInDeck':
      return ctx.run.deck.filter((c) => c.enhancements.length > 0).length;
    case 'distinctMonthsCaptured': {
      const s = new Set<Month>();
      for (const id of capturedIdentities(ctx)) for (const m of id.scoringMonths) s.add(m);
      return s.size;
    }
    case 'uniqueBrightsCaptured':
      return new Set(capturedIdentities(ctx).filter((i) => i.bright).map((i) => i.def.id)).size;
    case 'brightsCaptured':
      return capturedIdentities(ctx).filter((i) => i.bright).length;
    case 'ribbonsCaptured':
      return capturedIdentities(ctx).filter((i) => i.countsAsRibbon).length;
    case 'animalsCaptured':
      return capturedIdentities(ctx).filter((i) => i.animal).length;
    case 'piValueCaptured':
      return capturedIdentities(ctx).reduce((s, i) => s + i.piValue, 0) + (stage?.bonusPi ?? 0);
    case 'piCardsCaptured':
      return capturedIdentities(ctx).filter((i) => i.piValue > 0).length;
    case 'capturedCount':
      return stage?.captured.length ?? 0;
    case 'stageScore':
      return stage?.score ?? 0;
    case 'stageTarget':
      return stage?.target ?? 0;
    case 'overkillPercent':
      return stage && stage.target > 0 ? Math.max(0, ((stage.score - stage.target) / stage.target) * 100) : 0;
    case 'turn':
      return stage?.turn ?? 0;
    case 'exchangesUsed':
      return stage?.exchangesUsed ?? 0;
    case 'retriggersThisStage':
      return stage?.retriggersThisStage ?? 0;
    case 'jokboTypesScoredThisTurn':
      return new Set(stage?.turnState.scoredJokbo ?? []).size;
    case 'ribbonSetsActivatedThisStage':
      return stage?.activatedRibbonSets.length ?? 0;
    case 'counter':
      return (arg && stage?.counters[arg]) || 0;
    case 'talismanCounter': {
      const t = ctx.run.talismans.find((x) => x.id === scope.source.talismanId);
      return (arg && t?.counters[arg]) || 0;
    }
    case 'jokboLastScore':
      return arg && stage ? (stage.ledger[arg as JokboId]?.lastScore ?? 0) : 0;
    case 'jokboLevel':
      return arg ? (ctx.run.jokbo[arg as JokboId]?.level ?? 1) : 1;
    case 'jokboPoints':
      return arg && stage ? (stage.ledger[arg as JokboId]?.points ?? 0) : 0;
    case 'chainDistinctSources':
      return ctx.chain?.sources.size ?? 0;
    case 'chainTriggerCount':
      return ctx.chain?.chain.triggerCount ?? 0;
    case 'subjectMonthCaptured': {
      const uid = scopeSubject(scope);
      if (!uid || !stage) return 0;
      const months = identityOf(ctx, uid).scoringMonths;
      return capturedIdentities(ctx).filter((i) => i.scoringMonths.some((m) => months.includes(m))).length;
    }
    case 'subjectLevel': {
      const uid = scopeSubject(scope);
      return uid ? identityOf(ctx, uid).level : 0;
    }
    case 'subjectPower': {
      const uid = scopeSubject(scope);
      return uid ? viewOf(ctx, uid).power : 0;
    }
    case 'ownerLevel':
      return scope.source.ownerUid ? identityOf(ctx, scope.source.ownerUid).level : 0;
    case 'eventDelta': {
      const e = scope.event;
      if (e && (e.type === 'JOKBO_COMPLETED' || e.type === 'JOKBO_INCREMENTED')) return e.delta;
      return 0;
    }
  }
}

export function evalValue(value: ValueExpr, scope: EvalScope): number {
  if (typeof value === 'number') return value;
  let x = readScalar(scope, value.scalar, value.arg);
  if (value.floorDiv) x = Math.floor(x / value.floorDiv);
  if (value.offset) x += value.offset;
  if (value.times !== undefined) x *= value.times;
  if (value.min !== undefined) x = Math.max(value.min, x);
  if (value.max !== undefined) x = Math.min(value.max, x);
  return x;
}

// ---------------------------------------------------------------- filters & conditions

export function matchesFilter(scope: EvalScope, uid: string | undefined, filter: CardFilter): boolean {
  if (!uid) return false;
  const { ctx } = scope;
  if (!findCard(ctx, uid)) return false;
  if (filter.owner && uid !== scope.source.ownerUid) return false;
  const id = identityOf(ctx, uid);
  if (filter.categories && !filter.categories.some((c) => id.categories.includes(c))) return false;
  if (filter.months && !id.scoringMonths.some((m) => filter.months!.includes(m))) return false;
  if (filter.ribbonTypes && !(id.ribbonType && filter.ribbonTypes.includes(id.ribbonType))) return false;
  if (filter.defIds && !filter.defIds.includes(id.def.id)) return false;
  if (filter.enhanced !== undefined && id.enhancements.length > 0 !== filter.enhanced) return false;
  if (filter.hasEnhancement && !id.enhancements.some((e) => e.id === filter.hasEnhancement)) return false;
  if (filter.hasMutation && !id.mutations.some((m) => m.id === filter.hasMutation)) return false;
  if (filter.multiMonth !== undefined && id.multiMonth !== filter.multiMonth) return false;
  if (filter.joker !== undefined && id.joker !== filter.joker) return false;
  if (filter.jokerForm && id.jokerForm !== filter.jokerForm) return false;
  if (filter.bright !== undefined && id.bright !== filter.bright) return false;
  if (filter.rainBright !== undefined && id.rainBright !== filter.rainBright) return false;
  if (filter.godori !== undefined && id.godori !== filter.godori) return false;
  if (filter.doublePi && id.piValue < 2) return false;
  if (filter.rain && !id.def.rain) return false;
  if (filter.minLevel !== undefined && id.level < filter.minLevel) return false;
  if (filter.maxLevel !== undefined && id.level > filter.maxLevel) return false;
  if (filter.negative !== undefined && id.negative !== filter.negative) return false;
  if (filter.mostCommonMonth && !id.scoringMonths.includes(mostCommonMonth(ctx))) return false;
  return true;
}

function compare(a: number, op: string, b: number): boolean {
  switch (op) {
    case '>=':
      return a >= b;
    case '<=':
      return a <= b;
    case '==':
      return a === b;
    case '>':
      return a > b;
    case '<':
      return a < b;
    case 'multipleOf':
      return b !== 0 && a > 0 && a % b === 0;
    default:
      return false;
  }
}

export function evalCondition(cond: Condition, scope: EvalScope): boolean {
  const { ctx } = scope;
  switch (cond.kind) {
    case 'jokbo': {
      const j = scopeJokbo(scope);
      return !!j && cond.ids.includes(j);
    }
    case 'jokboGroup': {
      const j = scopeJokbo(scope);
      return !!j && cond.groups.includes(JOKBO_DEFS[j].group);
    }
    case 'reason': {
      const r = scopeReason(scope);
      return !!r && cond.reasons.includes(r);
    }
    case 'subject':
      return matchesFilter(scope, scopeSubject(scope), cond.filter);
    case 'triggerCard':
      return matchesFilter(scope, scopeTriggerCard(scope), cond.filter);
    case 'member': {
      const n = scopeMembers(scope).filter((u) => matchesFilter(scope, u, cond.filter)).length;
      return n >= (cond.min ?? 1);
    }
    case 'allMembers': {
      const list = scopeContributors(scope);
      return list.length > 0 && list.every((u) => matchesFilter(scope, u, cond.filter));
    }
    case 'scalar':
      return compare(evalValue(cond.value, scope), cond.op, cond.than);
    case 'flag':
      return !!ctx.stage?.flags[cond.flag] === cond.value;
    case 'jokboActive':
      return (ctx.stage?.ledger[cond.id]?.points ?? 0) > 0;
    case 'weather':
      return ctx.stage?.weather === cond.weather;
    case 'firstOfMonthThisStage': {
      const uid = scopeSubject(scope);
      if (!uid || !ctx.stage) return false;
      const months = identityOf(ctx, uid).scoringMonths;
      if (!months.length) return false;
      const before = ctx.stage.captured.slice(0, Math.max(0, ctx.stage.captured.indexOf(uid)));
      const seen = new Set<Month>();
      for (const b of before) for (const m of identityOf(ctx, b).scoringMonths) seen.add(m);
      return months.some((m) => !seen.has(m));
    }
    case 'firstOfIdentityThisStage': {
      const uid = scopeSubject(scope);
      if (!uid || !ctx.stage) return false;
      const defId = identityOf(ctx, uid).def.id;
      const idx = ctx.stage.captured.indexOf(uid);
      const before = ctx.stage.captured.slice(0, Math.max(0, idx));
      return !before.some((b) => identityOf(ctx, b).def.id === defId);
    }
    case 'captureFrom': {
      const e = scope.event;
      return !!e && e.type === 'CARD_CAPTURED' && cond.from.includes(e.from);
    }
    case 'not':
      return !evalCondition(cond.cond, scope);
    case 'any':
      return cond.conds.some((c) => evalCondition(c, scope));
    case 'custom': {
      const fn = CUSTOM_CONDITIONS[cond.id];
      return fn ? fn(scope) : false;
    }
  }
}

export function conditionsPass(conds: Condition[] | undefined, scope: EvalScope): boolean {
  if (!conds) return true;
  for (const c of conds) if (!evalCondition(c, scope)) return false;
  return true;
}
