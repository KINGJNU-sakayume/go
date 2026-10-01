import type {
  CardCategory,
  EnhancementId,
  JokboGroup,
  JokboId,
  JokerFormId,
  Month,
  MutationId,
  RibbonType,
  Weather,
} from './primitives';
import type { GameEventType, TriggerReason } from './events';

/**
 * Hooks an effect can attach to.
 * - Game event types: reactions that return new events (the trigger engine).
 * - SCORE_*: modifiers that join the scoring pipeline for one scoring event.
 * - CARD_POWER: modifiers to a card's power.
 * - RULES: passive rule changes (read by the engine when it needs a rule value).
 * - SHOP: price changes.
 */
export type ScoreHook = 'SCORE_JOKBO' | 'SCORE_CAPTURE' | 'SCORE_BONUS' | 'SCORE_ALL';
export type PassiveHook = 'CARD_POWER' | 'RULES' | 'SHOP';
export type TriggerKind = GameEventType | ScoreHook | PassiveHook;

export type SourceKind =
  | 'talisman'
  | 'enhancement'
  | 'mutation'
  | 'joker'
  | 'evolution'
  | 'stage'
  | 'weather'
  | 'core';

export interface SourceRef {
  kind: SourceKind;
  id: string;
  label: string;
  cardUid?: string;
  jokboId?: JokboId;
}

/** Numbers that can be read from the current game state. */
export type ScalarId =
  | 'deckSize'
  | 'cardsRemovedFromStart'
  | 'duplicatesInDeck'
  | 'monthsMissingFromDeck'
  | 'jokersInDeck'
  | 'enhancedInDeck'
  | 'distinctMonthsCaptured'
  | 'uniqueBrightsCaptured'
  | 'brightsCaptured'
  | 'overkillPercent'
  | 'ribbonsCaptured'
  | 'animalsCaptured'
  | 'piValueCaptured'
  | 'piCardsCaptured'
  | 'capturedCount'
  | 'stageScore'
  | 'stageTarget'
  | 'turn'
  | 'exchangesUsed'
  | 'retriggersThisStage'
  | 'jokboTypesScoredThisTurn'
  | 'ribbonSetsActivatedThisStage'
  | 'counter'
  | 'talismanCounter'
  | 'jokboLastScore'
  | 'jokboLevel'
  | 'jokboPoints'
  | 'chainDistinctSources'
  | 'chainTriggerCount'
  | 'subjectMonthCaptured'
  | 'subjectLevel'
  | 'subjectPower'
  | 'ownerLevel'
  | 'eventDelta';

export interface ScalarExpr {
  scalar: ScalarId;
  /** Argument for parameterized scalars (counter name, jokbo id). */
  arg?: string;
  floorDiv?: number;
  offset?: number;
  times?: number;
  min?: number;
  max?: number;
}

export type ValueExpr = number | ScalarExpr;

export interface CardFilter {
  categories?: CardCategory[];
  months?: Month[];
  ribbonTypes?: RibbonType[];
  defIds?: string[];
  enhanced?: boolean;
  hasEnhancement?: EnhancementId;
  hasMutation?: MutationId;
  multiMonth?: boolean;
  joker?: boolean;
  jokerForm?: JokerFormId;
  bright?: boolean;
  rainBright?: boolean;
  godori?: boolean;
  doublePi?: boolean;
  rain?: boolean;
  minLevel?: number;
  maxLevel?: number;
  /** The card that owns this effect (enhancement / mutation / joker). */
  owner?: boolean;
  negative?: boolean;
  /** Card's month is the most common month in the deck. */
  mostCommonMonth?: boolean;
}

export type CompareOp = '>=' | '<=' | '==' | '>' | '<' | 'multipleOf';

export type Condition =
  | { kind: 'jokbo'; ids: JokboId[] }
  | { kind: 'jokboGroup'; groups: JokboGroup[] }
  | { kind: 'reason'; reasons: TriggerReason[] }
  /** The event's card / the scored capture card / the card whose power is computed. */
  | { kind: 'subject'; filter: CardFilter }
  /** The card that caused the Jokbo event. */
  | { kind: 'triggerCard'; filter: CardFilter }
  /** Jokbo members (all cards counting toward it) — at least `min` match. */
  | { kind: 'member'; filter: CardFilter; min?: number }
  | { kind: 'allMembers'; filter: CardFilter }
  | { kind: 'scalar'; value: ValueExpr; op: CompareOp; than: number }
  | { kind: 'flag'; flag: string; value: boolean }
  | { kind: 'jokboActive'; id: JokboId }
  | { kind: 'weather'; weather: Weather }
  | { kind: 'firstOfMonthThisStage' }
  | { kind: 'firstOfIdentityThisStage' }
  | { kind: 'captureFrom'; from: ('hand' | 'stock' | 'service' | 'bomb' | 'effect')[] }
  | { kind: 'not'; cond: Condition }
  | { kind: 'any'; conds: Condition[] }
  | { kind: 'custom'; id: string };

export type RetriggerTarget =
  | 'event'
  | 'lastCompleted'
  | 'onlyScoredThisTurn'
  | 'onlyRibbonSetThisStage'
  | { jokbo: JokboId };

export interface CardTarget {
  from: 'subject' | 'owner' | 'captured' | 'hand' | 'deck' | 'field';
  filter?: CardFilter;
  pick: 'random' | 'highestLevel' | 'lowestLevel' | 'all';
}

export type RuleKey =
  | 'doublePiValue'
  | 'rainBrightPenalty'
  | 'exchangesPerStage'
  | 'adjacentRange'
  | 'basePreview'
  | 'turnsPerStage'
  | 'handSize';

export type EffectAction =
  // --- scoring pipeline (SCORE_* hooks) ---
  | { kind: 'jokboMult'; value: ValueExpr }
  | { kind: 'jokboMultAdd'; value: ValueExpr }
  | { kind: 'globalMult'; value: ValueExpr }
  | { kind: 'globalMultAdd'; value: ValueExpr }
  | { kind: 'flat'; value: ValueExpr }
  | { kind: 'baseMult'; value: ValueExpr }
  | { kind: 'captureMult'; value: ValueExpr }
  // --- card power (CARD_POWER hook) ---
  | { kind: 'power'; value: ValueExpr }
  | { kind: 'powerMult'; value: ValueExpr }
  | { kind: 'levelPowerMult'; value: ValueExpr }
  // --- passive rules / shop ---
  | { kind: 'rule'; rule: RuleKey; value: number | boolean; mode?: 'set' | 'add' | 'max' }
  | { kind: 'priceMult'; service: string; value: number; firstOnly?: boolean }
  // --- reactions (game event hooks) ---
  | { kind: 'addScore'; value: ValueExpr; label: string; applyGlobal?: boolean }
  | { kind: 'retrigger'; target: RetriggerTarget; times?: number }
  | { kind: 'retriggerCapture' }
  | { kind: 'upgradeCard'; target: CardTarget; levels: number; scope: 'run' | 'stage'; count?: ValueExpr }
  | { kind: 'tempEnhance'; target: CardTarget; enhancement: EnhancementId | 'random' }
  | { kind: 'gainPower'; target: CardTarget; value: ValueExpr; scope: 'run' | 'stage' }
  | { kind: 'grantExchange'; value: ValueExpr }
  | { kind: 'stageGlobalMultAdd'; value: ValueExpr }
  | { kind: 'stageGlobalMult'; value: number }
  | { kind: 'stageMonthMult'; month: 'subject' | Month; value: number }
  | { kind: 'stageJokboMultAdd'; jokbo: 'event' | JokboId; value: ValueExpr }
  | { kind: 'preview'; value: ValueExpr }
  | { kind: 'coins'; value: ValueExpr }
  | { kind: 'setFlag'; flag: string; value: boolean }
  | { kind: 'counter'; counter: string; op: 'add' | 'set'; value: ValueExpr; scope: 'stage' | 'talisman' }
  | { kind: 'nextStageExchange'; value: ValueExpr }
  | { kind: 'copyProfile'; from: 'lastCapturedNonJoker' | 'highestLevelCaptured' | 'partner' }
  | { kind: 'message'; text: string }
  | { kind: 'custom'; id: string };

export interface EffectLimit {
  perStage?: number;
  perTurn?: number;
  perChain?: number;
}

export interface EffectSpec {
  trigger: TriggerKind;
  conditions?: Condition[];
  effects: EffectAction[];
  limit?: EffectLimit;
  /** Short shout shown in the chain view when this fires (defaults to the source name). */
  shout?: string;
}
