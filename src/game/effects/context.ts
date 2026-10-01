import type {
  CardInstance,
  CardView,
  JokboId,
  Month,
  RulesConfig,
  RunState,
  ScoringProfile,
  StageDefinition,
  StageState,
  TempCardState,
  TriggerChain,
} from '../types';
import { Rng } from '../rng/rng';
import { computeIdentity, mostCommonMonthOf, toScoringProfile, type CardIdentity, type IdentityContext } from '../cards/identity';
import type { ActiveSource, SourceIndex } from './sources';

export interface ChainRuntime {
  chain: TriggerChain;
  signatureCounts: Map<string, number>;
  sources: Set<string>;
}

/**
 * Everything an effect or engine step can read. Built per engine call; the engine
 * mutates `run` / `stage` (which are already private copies) while processing events.
 */
export interface GameContext {
  run: RunState;
  stage?: StageState;
  stageDef?: StageDefinition;
  rng: Rng;
  chain?: ChainRuntime;
  /** Cached derived data; call `invalidate(ctx)` after structural changes. */
  cache: {
    cards?: Map<string, CardInstance>;
    rules?: RulesConfig;
    identityCtx?: IdentityContext;
    sourceIndex?: SourceIndex;
    mostCommonMonth?: Month;
  };
}

export function makeContext(run: RunState, stage: StageState | undefined, rng: Rng, stageDef?: StageDefinition): GameContext {
  return { run, stage, stageDef, rng, cache: {} };
}

export function invalidate(ctx: GameContext, what: 'all' | 'sources' | 'cards' = 'all'): void {
  if (what === 'all' || what === 'cards') {
    ctx.cache.cards = undefined;
    ctx.cache.mostCommonMonth = undefined;
    ctx.cache.identityCtx = undefined;
    ctx.cache.rules = undefined;
  }
  if (what === 'all' || what === 'sources' || what === 'cards') ctx.cache.sourceIndex = undefined;
}

export function cardMap(ctx: GameContext): Map<string, CardInstance> {
  if (!ctx.cache.cards) ctx.cache.cards = new Map(ctx.run.deck.map((c) => [c.uid, c]));
  return ctx.cache.cards;
}

export function getCard(ctx: GameContext, uid: string): CardInstance {
  const c = cardMap(ctx).get(uid);
  if (!c) throw new Error(`Card ${uid} is not in the run deck`);
  return c;
}

export function findCard(ctx: GameContext, uid: string): CardInstance | undefined {
  return cardMap(ctx).get(uid);
}

export function tempOf(ctx: GameContext, uid: string): TempCardState | undefined {
  return ctx.stage?.temp[uid];
}

export function ensureTemp(stage: StageState, uid: string): TempCardState {
  let t = stage.temp[uid];
  if (!t) {
    t = { levelBonus: 0, powerBonus: 0, powerMult: 1, enhancements: [], tags: [] };
    stage.temp[uid] = t;
  }
  return t;
}

// Late-bound hooks (set by effects/power.ts and effects/rules.ts) to avoid import cycles.
type RulesResolver = (ctx: GameContext) => RulesConfig;
type PowerResolver = (ctx: GameContext, identity: CardIdentity) => Pick<CardView, 'power' | 'powerParts'>;
let rulesResolver: RulesResolver | undefined;
let powerResolver: PowerResolver | undefined;

export function registerResolvers(r: RulesResolver, p: PowerResolver): void {
  rulesResolver = r;
  powerResolver = p;
}

export function effectiveRules(ctx: GameContext): RulesConfig {
  if (!ctx.cache.rules) {
    // Seed with base rules first so rule hooks that read card identity cannot recurse.
    ctx.cache.rules = ctx.run.rules;
    const resolved = rulesResolver ? rulesResolver(ctx) : ctx.run.rules;
    ctx.cache.rules = resolved;
    ctx.cache.identityCtx = undefined;
  }
  return ctx.cache.rules;
}

export function mostCommonMonth(ctx: GameContext): Month {
  if (ctx.cache.mostCommonMonth === undefined) {
    ctx.cache.mostCommonMonth = mostCommonMonthOf(ctx.run.deck, {
      rules: ctx.run.rules,
      adjacentRange: 1,
    });
  }
  return ctx.cache.mostCommonMonth;
}

export function identityCtx(ctx: GameContext): IdentityContext {
  if (!ctx.cache.identityCtx) {
    const rules = effectiveRules(ctx);
    const wind = ctx.stage?.weather === 'wind';
    ctx.cache.identityCtx = {
      rules,
      mostCommonMonth: mostCommonMonth(ctx),
      adjacentRange: rules.adjacentRange + (wind ? 1 : 0),
    };
  }
  return ctx.cache.identityCtx;
}

export function identityOf(ctx: GameContext, uid: string): CardIdentity {
  return computeIdentity(getCard(ctx, uid), tempOf(ctx, uid), identityCtx(ctx));
}

export function viewOf(ctx: GameContext, uid: string): CardView {
  const identity = identityOf(ctx, uid);
  const power = powerResolver ? powerResolver(ctx, identity) : { power: identity.def.basePower, powerParts: [] };
  return { ...identity, ...power };
}

export function viewOfCard(ctx: GameContext, card: CardInstance): CardView {
  const identity = computeIdentity(card, tempOf(ctx, card.uid), identityCtx(ctx));
  const power = powerResolver ? powerResolver(ctx, identity) : { power: identity.def.basePower, powerParts: [] };
  return { ...identity, ...power };
}

export function profileOf(ctx: GameContext, uid: string): ScoringProfile {
  return toScoringProfile(viewOf(ctx, uid), tempOf(ctx, uid));
}

export function capturedProfiles(ctx: GameContext): ScoringProfile[] {
  return (ctx.stage?.captured ?? []).map((uid) => profileOf(ctx, uid));
}

export function jokboLevel(ctx: GameContext, id: JokboId): number {
  return ctx.run.jokbo[id]?.level ?? 1;
}

export type { ActiveSource };
