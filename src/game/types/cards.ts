import type {
  AnimalKind,
  CardCategory,
  EnhancementId,
  JokboId,
  JokerFormId,
  Month,
  MutationId,
  Rarity,
  RibbonType,
} from './primitives';
import type { EffectSpec } from './effects';

/** Static, printed identity of a Hwatu card. Many CardInstances can share one definition. */
export interface CardDefinition {
  id: string;
  month: Month | null;
  category: CardCategory;
  nameKo: string;
  nameEn: string;
  plantKo: string;
  plantEn: string;
  ribbonType?: RibbonType;
  /** Pi contribution when captured (Pi = 1, Double Pi = 2, Joker = 2). */
  piValue: number;
  doublePi?: boolean;
  rainBright?: boolean;
  godori?: boolean;
  animalKind?: AnimalKind;
  /** December cards are "rain" cards (weather effects). */
  rain?: boolean;
  /** Animal that rule variants may count as double Pi (May bridge, September sake cup). */
  doublePiVariant?: 'may' | 'september';
  basePower: number;
}

export interface EnhancementInstance {
  id: EnhancementId;
  stacks: number;
  /** Dual Month: the extra month used for matching. */
  month?: Month;
}

export interface MutationInstance {
  id: MutationId;
  month?: Month;
  months?: Month[];
  category?: CardCategory;
  ribbonType?: RibbonType;
  amount?: number;
}

export type CardOrigin =
  | 'starter'
  | 'clone'
  | 'perfectClone'
  | 'reward'
  | 'shop'
  | 'event'
  | 'rebirth'
  | 'debug';

/** One physical card in the run deck. uid is unique per physical card; defId points to its printed identity. */
export interface CardInstance {
  uid: string;
  defId: string;
  level: number;
  enhancements: EnhancementInstance[];
  mutations: MutationInstance[];
  /** Permanent accumulated power (Bloom, Parasite, events). */
  bonusPower: number;
  jokerForm?: JokerFormId;
  permanentTags: string[];
  origin: CardOrigin;
  clonedFrom?: string;
}

/** Profile fields a card can copy from another (Mirror mutation, Mirror Joker, 광대탈). */
export interface CopiedProfile {
  fromUid: string;
  fromName: string;
  months: Month[];
  bright: boolean;
  rainBright: boolean;
  animal: boolean;
  ribbonTypes: RibbonType[];
  countsAsRibbon: boolean;
  pi: number;
}

/** Per-stage, temporary card modifications. Cleared when the stage ends. */
export interface TempCardState {
  levelBonus: number;
  powerBonus: number;
  powerMult: number;
  enhancements: EnhancementInstance[];
  tags: string[];
  copied?: CopiedProfile;
  impostor?: { jokboId: JokboId; slotIndex: number; label: string };
  /** Moon Joker: month it represents this stage. */
  moonMonth?: Month;
  /** February frost: this field card cannot be paired up to and including this turn. */
  frozenUntil?: number;
}

export interface PowerPart {
  label: string;
  value: number;
}

/** Fully computed, effective view of a card in the current context. Never stored. */
export interface CardView {
  card: CardInstance;
  def: CardDefinition;
  name: string;
  level: number;
  printedMonth: Month | null;
  /** Months that count for scoring identity (printed + Split/Triple Moon). */
  scoringMonths: Month[];
  /** Months the card can match with (scoring + Dual Month + Adjacent, or all for Wild). */
  matchMonths: Month[];
  wild: boolean;
  categories: CardCategory[];
  ribbonType?: RibbonType;
  bright: boolean;
  rainBright: boolean;
  pseudoBright: boolean;
  animal: boolean;
  ribbon: boolean;
  countsAsRibbon: boolean;
  piValue: number;
  joker: boolean;
  jokerForm?: JokerFormId;
  godori: boolean;
  enhancements: EnhancementInstance[];
  tempEnhancements: EnhancementInstance[];
  mutations: MutationInstance[];
  negative: boolean;
  multiMonth: boolean;
  power: number;
  powerParts: PowerPart[];
  /** Plain-language explanations of every rule this card bends. */
  notes: string[];
}

/** Identity used by the Jokbo evaluator. */
export interface ScoringProfile {
  uid: string;
  defId: string;
  months: Month[];
  bright: boolean;
  rainBright: boolean;
  animal: boolean;
  ribbonTypes: RibbonType[];
  countsAsRibbon: boolean;
  pi: number;
  joker: boolean;
  forcedSlots: { jokboId: JokboId; slotIndex: number }[];
  level: number;
  power: number;
  enhanced: boolean;
}

export interface EnhancementDefinition {
  id: EnhancementId;
  name: string;
  nameEn: string;
  rarity: Rarity;
  description: string;
  glyph: string;
  color: string;
  stackable: boolean;
  needsMonth?: boolean;
  /** Mixed blessing (Cursed) — Purification can remove it. */
  mixed?: boolean;
  specs: EffectSpec[];
}

export interface MutationDefinition {
  id: MutationId;
  name: string;
  nameEn: string;
  rarity: Rarity;
  description: string;
  glyph: string;
  negative: boolean;
  specs: EffectSpec[];
}

export interface JokerFormDefinition {
  id: JokerFormId;
  name: string;
  nameEn: string;
  rarity: Rarity;
  description: string;
  glyph: string;
  color: string;
  /** Pi value when captured. */
  piValue: number;
  specs: EffectSpec[];
}
