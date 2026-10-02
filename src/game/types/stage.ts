import type { JokboId, Month, Weather } from './primitives';
import type { EffectSpec } from './effects';
import type { TempCardState } from './cards';
import type { JokboLedgerEntry } from './jokbo';
import type { TriggerChain } from './events';
import type { RngState } from '../rng/rng';

export interface StageModifierDefinition {
  id: string;
  name: string;
  description: string;
  specs: EffectSpec[];
}

/** Built-in stage mechanics that need engine support beyond the effect DSL. */
export interface StageMechanics {
  /** March: every N turns a random field card is covered. */
  coverEvery?: number;
  /** May: every N turns a field card falls off the bridge (to the stock bottom) and the stock top replaces it. */
  bridgeDropEvery?: number;
  /** June: each retrigger reduces the next retrigger's base value by this fraction. */
  retriggerDecay?: number;
  /** September: every N scored effects add one Drunk; at 3 Drunk a random hand card is soaked and replaced. */
  drunkEvery?: number;
  /** October: every N Exchanges a random hand card gains a temporary enhancement. */
  exchangeEnhanceEvery?: number;
  /** August: number of upcoming stock cards always visible. */
  previewStock?: number;
  /** December: weather changes every N turns. */
  weatherEvery?: number;
  /** November: GO reward multiplier bonus. */
  goRewardBonus?: number;
  /** February: unmatched hand cards freeze for this many turns (the turn they are laid down included). */
  frostTurns?: number;
}

export interface GoHazard {
  /** After GO, the new line = score at GO × this. */
  lineMult: number;
  /** Coin multiplier gained per GO. */
  coinBonusPerGo: number;
  /** Fraction of coins lost when a GO busts. */
  bustCoinLoss: number;
  description: string;
}

export interface StageDefinition {
  index: number;
  month: Month;
  name: string;
  nameEn: string;
  boss: boolean;
  finalBoss?: boolean;
  target: number;
  coinReward: number;
  description: string;
  ruleText: string[];
  modifiers: StageModifierDefinition[];
  mechanics: StageMechanics;
  goHazard: GoHazard;
  /** Optional per-stage overrides of the rules config. */
  turns?: number;
  handSize?: number;
  fieldSize?: number;
  exchanges?: number;
}

export type StagePhase =
  | 'play'
  | 'chooseHandTarget'
  | 'chooseStockTarget'
  | 'chooseExchange'
  | 'goStop'
  | 'cleared'
  | 'failed';

export interface CaptureOption {
  id: string;
  kind: 'single' | 'stack' | 'place';
  targetUids: string[];
  month?: Month;
}

export interface PendingChoice {
  kind: 'hand' | 'stock' | 'exchange';
  cardUid: string;
  options: CaptureOption[];
  /** Exchange (Lucky): the drawn candidates to keep one of. */
  candidates?: string[];
  free?: boolean;
  /** Hand choice: the play was declared as 흔들기. */
  shake?: boolean;
}

export interface StageTurnState {
  scoredJokbo: JokboId[];
  playedUid?: string;
  playedPlaced: boolean;
  handCaptureMonths: Month[];
  handCaptureSingle: boolean;
  fieldHadCards: boolean;
}

/** 뻑: three cards of one month left stacked on the field until the fourth one takes them all. */
export interface PpeokPile {
  month: Month;
  uids: string[];
  turn: number;
}

export interface CaptureActionRecord {
  id: number;
  months: Month[];
  /** Every card taken by this action (hand/stock card + its targets). Missing in v2 saves. */
  uids?: string[];
}

export interface StageState {
  stageIndex: number;
  turn: number;
  turnsTotal: number;
  phase: StagePhase;
  hand: string[];
  field: string[];
  stock: string[];
  captured: string[];
  discard: string[];
  covered: string[];
  score: number;
  target: number;
  goLine?: number;
  goCount: number;
  goBust: boolean;
  exchangesLeft: number;
  exchangesUsed: number;
  freeExchangesUsed: number;
  previewCount: number;
  temp: Record<string, TempCardState>;
  ledger: Record<JokboId, JokboLedgerEntry>;
  counters: Record<string, number>;
  flags: Record<string, boolean>;
  usage: Record<string, number>;
  globalMultAdd: number;
  globalMultFactor: number;
  monthMult: Partial<Record<Month, number>>;
  weather?: Weather;
  drunk: number;
  scoredEffects: number;
  retriggersThisStage: number;
  rng: RngState;
  chains: TriggerChain[];
  nextEventId: number;
  nextChainId: number;
  pending?: PendingChoice;
  turnState: StageTurnState;
  /** Capture actions in order (달의 메아리 compares consecutive actions). */
  captureActions: CaptureActionRecord[];
  nextActionId: number;
  lastCapturedNonJoker?: string;
  lastCompletedJokbo?: JokboId;
  firstUnmatchedApplied: boolean;
  activatedRibbonSets: JokboId[];
  coinsEarned: number;
  bestChainScore: number;
  longestChain: number;
  overflowed: boolean;
  /** Display order for hand (September Drunk shuffles this). */
  handOrderSeed: number;
  /** 뻑 piles currently on the field. */
  ppeokPiles: PpeokPile[];
  /** 뻑 count this stage (삼뻑 on the third). */
  ppeokCount: number;
  lastPpeokTurn?: number;
  /** 피 taken by 피 뺏기 (쪽, 따닥, 싹쓸이, 폭탄, 자뻑); counts toward the 피 Jokbo. */
  bonusPi: number;
  /** 흔들기 stacks this stage (폭탄 and 총통 count too); each multiplies all later scores. */
  shakeCount: number;
}
