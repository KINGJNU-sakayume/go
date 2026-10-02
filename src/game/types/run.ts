import type {
  BuildTag,
  CardCategory,
  EnhancementId,
  JokboId,
  JokerFormId,
  Month,
  Rarity,
} from './primitives';
import type { CardFilter, Condition, EffectAction, EffectLimit, EffectSpec, TriggerKind } from './effects';
import type { CardInstance, EnhancementInstance, MutationInstance } from './cards';
import type { JokboProgress } from './jokbo';
import type { StageState } from './stage';

export interface RulesConfig {
  handSize: number;
  fieldSize: number;
  turnsPerStage: number;
  exchangesPerStage: number;
  jokerCount: number;
  minDeckSize: number;
  /** Value of one traditional point in roguelike score. */
  pointValue: number;
  rainRibbonCountsAsRibbon: boolean;
  mayAnimalDoublePi: boolean;
  septemberAnimalDoublePi: boolean;
  jokerPiValue: number;
  doublePiValue: number;
  rainBrightPenalty: boolean;
  wrapAdjacentMonths: boolean;
  /** How far Adjacent Month reaches (December Wind adds +1). */
  adjacentRange: number;
  /** Upcoming stock cards always visible. */
  basePreview: number;
  goEnabled: boolean;
  /** 뻑: hand capture + same-month stock card leaves all three on the field. */
  ppeok: boolean;
  /** 흔들기: playing a card while holding three of its month (none on the field) multiplies later scores. */
  shake: boolean;
  /** 피 뺏기: 쪽 / 따닥 / 싹쓸이 / 폭탄 / 자뻑 add bonus 피 toward the 피 Jokbo. */
  piSteal: boolean;
  maxChainResolutions: number;
  maxChainDepth: number;
  loopRepeatLimit: number;
}

export interface TalismanDefinition {
  id: string;
  number: number;
  name: string;
  nameEn: string;
  rarity: Rarity;
  description: string;
  tags: BuildTag[];
  glyph: string;
  trigger: TriggerKind;
  conditions: Condition[];
  effects: EffectAction[];
  limit?: EffectLimit;
  shout?: string;
  extraSpecs?: EffectSpec[];
}

export interface TalismanInstance {
  id: string;
  counters: Record<string, number>;
  acquiredAt: number;
}

export type RunPhase =
  | 'stage'
  | 'stageResult'
  | 'reward'
  | 'crossroads'
  | 'shop'
  | 'event'
  | 'victory'
  | 'defeat';

export interface RunModifiers {
  /** Multiplier on the next boss stage's target (노름꾼의 장부). */
  bossTargetMult: number;
  nextStageExchangeBonus: number;
  nextStageGlobalAdd: number;
  nextStageScoreMult: number;
  permanentGlobalAdd: number;
  /** Flat bonus added to every Jokbo event (빈자리 etc. track their own counters). */
  permanentJokboFlat: number;
}

export interface RunStats {
  totalScore: number;
  highestChainScore: number;
  highestChainTitle: string;
  longestChain: number;
  highestEventScore: number;
  cardsRemoved: number;
  cardsDuplicated: number;
  cardsAdded: number;
  cardsMutated: number;
  cardsUpgraded: number;
  jokboTriggers: Partial<Record<JokboId, number>>;
  bossesDefeated: number;
  goDecisions: number;
  goBusts: number;
  stagesCleared: number;
  talismansObtained: string[];
  overflowCount: number;
  stageScores: number[];
  coinsEarned: number;
}

export type OperationKind =
  | 'removeCard'
  | 'upgradeCard'
  | 'duplicateCard'
  | 'perfectClone'
  | 'enhanceCard'
  | 'mutateCard'
  | 'monthShift'
  | 'ribbonDye'
  | 'typeGraft'
  | 'splitMoon'
  | 'purify'
  | 'jokerWorkshop'
  | 'upgradeJokbo'
  | 'chooseEvolution'
  | 'levelEnhancement'
  | 'specialUpgrade'
  | 'gambleCard'
  | 'ancientCard'
  | 'discoverMonth';

export interface PendingOperation {
  id: number;
  kind: OperationKind;
  title: string;
  description: string;
  source: 'reward' | 'shop' | 'event' | 'levelUp' | 'debug';
  filter?: CardFilter;
  count: number;
  levels?: number;
  enhancement?: EnhancementId;
  addEnhancement?: EnhancementId;
  jokboId?: JokboId;
  cardUid?: string;
  chance?: number;
  cancellable: boolean;
  refund?: number;
  /** Is this a removal that counts as a sacrifice (Hollow / Rebirth hooks still apply). */
  sacrifice?: boolean;
  then: OutcomeStep[];
}

export interface OperationInput {
  cardUids?: string[];
  choiceId?: string;
  month?: Month;
  category?: CardCategory;
  jokboId?: JokboId;
  cancel?: boolean;
}

export interface OperationChoice {
  id: string;
  label: string;
  description: string;
  rarity?: Rarity;
  preview?: string;
  disabled?: string;
}

export type RunModifierKey = keyof RunModifiers;

export type OutcomeStep =
  | { op: 'gainCoins'; amount: number }
  | { op: 'loseCoins'; amount: number }
  | { op: 'loseCoinFraction'; fraction: number }
  | { op: 'gainTalisman'; talismanId: string }
  | { op: 'gainRandomTalisman'; rarity: Rarity }
  | { op: 'upgradeJokboFixed'; jokboId: JokboId; levels: number }
  | { op: 'addCard'; defId: string; level?: number; enhancements?: EnhancementInstance[]; mutations?: MutationInstance[]; jokerForm?: JokerFormId }
  | { op: 'addJoker'; form: JokerFormId }
  | { op: 'addCursedCard' }
  | { op: 'cloneCard'; uid: string; exact: boolean }
  | { op: 'upgradeCards'; uids: string[]; levels: number }
  | { op: 'upgradeMatching'; filter: CardFilter; levels: number }
  | { op: 'removeCards'; uids: string[] }
  | { op: 'mutateSpecific'; uid: string; mutation: MutationInstance; levels?: number }
  | { op: 'runModifier'; key: RunModifierKey; value: number; mode: 'add' | 'mult' }
  | { op: 'interactive'; operation: Omit<PendingOperation, 'id' | 'then'> }
  | { op: 'gamble'; chance: number; label: string; win: OutcomeStep[]; lose: OutcomeStep[] }
  | { op: 'randomRareReward' }
  | { op: 'randomCurse' }
  | { op: 'message'; text: string };

export type RewardKind =
  | 'talisman'
  | 'upgradeCard'
  | 'removeCard'
  | 'duplicateCard'
  | 'perfectClone'
  | 'enhanceCard'
  | 'mutateCard'
  | 'upgradeJokbo'
  | 'addJoker'
  | 'jokerWorkshop'
  | 'coins';

export interface RewardOption {
  id: string;
  kind: RewardKind;
  title: string;
  description: string;
  rarity: Rarity;
  preview?: string;
  steps: OutcomeStep[];
  talismanId?: string;
  jokboId?: JokboId;
  enhancement?: EnhancementId;
}

export interface RewardState {
  options: RewardOption[];
  boss: boolean;
  picked?: string;
}

export type ShopServiceKind =
  | 'removal'
  | 'upgrade'
  | 'mutation'
  | 'duplicate'
  | 'perfectClone'
  | 'jokboTraining'
  | 'talisman'
  | 'jokerWorkshop'
  | 'monthDye'
  | 'ribbonDye'
  | 'purify'
  | 'enhancement'
  | 'addJoker';

export interface ShopOffer {
  id: string;
  service: ShopServiceKind;
  title: string;
  description: string;
  price: number;
  rarity: Rarity;
  sold: boolean;
  repeatable: boolean;
  talismanId?: string;
  jokboId?: JokboId;
  enhancement?: EnhancementId;
  jokerForm?: JokerFormId;
  preview?: string;
}

export interface ShopState {
  nodeIndex: number;
  offers: ShopOffer[];
  rerolls: number;
  purchasesHere: number;
  piRemovalDiscountUsed: boolean;
  /** Highest price among offers when the shop was generated (도박사의 손). */
  message?: string;
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  cost?: number;
  disabled?: string;
  probability?: number;
  steps: OutcomeStep[];
  keepOpen?: boolean;
  /** Choice id that this choice reveals (장터의 사기꾼). */
  reveals?: string;
  /** Hidden until revealed (label/description show as ???). */
  concealed?: boolean;
}

export interface EventState {
  eventId: string;
  title: string;
  titleEn: string;
  text: string;
  choices: EventChoice[];
  resolved: boolean;
  resultText?: string;
  revealed: string[];
  /** Cards shown by the event (e.g. 찢어진 화투). */
  shownCards: string[];
}

export interface EventEncounterDefinition {
  id: string;
  name: string;
  nameEn: string;
  teaser: string;
  tags: BuildTag[];
}

export interface CrossroadsOption {
  id: string;
  kind: 'shop' | 'event';
  eventId?: string;
  title: string;
  description: string;
}

export interface CrossroadsState {
  options: CrossroadsOption[];
}

export interface StageCoinBreakdown {
  base: number;
  overkill: number;
  go: number;
  talismans: number;
  bustPenalty: number;
  total: number;
}

export interface StageResult {
  stageIndex: number;
  cleared: boolean;
  score: number;
  target: number;
  goCount: number;
  bust: boolean;
  coins: StageCoinBreakdown;
  bestChain: number;
  longestChain: number;
}

export interface RunHistoryEntry {
  stageIndex: number;
  text: string;
}

export interface RunState {
  version: number;
  seed: string;
  createdAt: number;
  rules: RulesConfig;
  deck: CardInstance[];
  nextUid: number;
  nextOpId: number;
  startingUids: string[];
  talismans: TalismanInstance[];
  jokbo: Record<JokboId, JokboProgress>;
  coins: number;
  stageIndex: number;
  /** Increments each time a node (stage, shop, event, reward) is generated — seeds per-node RNG. */
  nodeCounter: number;
  phase: RunPhase;
  stage?: StageState;
  stageResult?: StageResult;
  reward?: RewardState;
  shop?: ShopState;
  event?: EventState;
  crossroads?: CrossroadsState;
  ops: PendingOperation[];
  removals: number;
  purchases: number;
  modifiers: RunModifiers;
  usedEvents: string[];
  stats: RunStats;
  history: RunHistoryEntry[];
}
