import type { JokboGroup, JokboId, Month, RibbonType } from './primitives';
import type { EffectSpec } from './effects';

export interface SlotSpec {
  month: Month;
  need: 'ribbon' | 'animal' | 'bright';
  ribbonType?: RibbonType;
  label: string;
}

export interface GwangTier {
  id: 'samgwang' | 'bisamgwang' | 'sagwang' | 'ogwang';
  name: string;
  nameEn: string;
  count: number;
  /** true → tier requires the Rain Bright to be among the brights (Bisamgwang). */
  withRain?: boolean;
  points: number;
}

export type JokboRule =
  | { kind: 'set'; slots: SlotSpec[]; pointsPerSet: number; repeatable: boolean }
  | {
      kind: 'count';
      measure: 'animal' | 'ribbon' | 'pi';
      threshold: number;
      basePoints: number;
      perExtra: number;
    }
  | { kind: 'gwang'; tiers: GwangTier[]; perExtraBeyondFive: number }
  | { kind: 'fullMonth'; setSize: number; pointsPerSet: number };

export interface JokboDefinition {
  id: JokboId;
  name: string;
  nameEn: string;
  /** Short shout for chain view, e.g. 'CHEONGDAN'. */
  shout: string;
  group: JokboGroup;
  description: string;
  rule: JokboRule;
  /** Points of the "headline" completion (for display). */
  traditionalPoints: number;
  color: string;
  glyph: string;
  evolutionIds: string[];
}

/** Run-persistent Jokbo progression. */
export interface JokboProgress {
  id: JokboId;
  level: number;
  evolutions: string[];
  bonusFlat: number;
  bonusMultAdd: number;
}

/** Per-stage scoring ledger entry. A Jokbo only scores when its points increase or it is retriggered. */
export interface JokboLedgerEntry {
  points: number;
  sets: number;
  tierLabel?: string;
  triggers: number;
  retriggers: number;
  lastScore: number;
  totalScore: number;
  lastTradPoints: number;
  lastContributors: string[];
  /** All members at the last trigger (count Jokbo use it to find the newly added cards). */
  memberSnapshot: string[];
  /** All captured cards currently counting toward this Jokbo (updated on every check). */
  members: string[];
  lastTriggerCard?: string;
  activatedTurn?: number;
  /** Stage-only additive Jokbo multiplier (Deep Blue etc.). */
  stageMultAdd: number;
}

export interface JokboEvaluation {
  points: number;
  progress: number;
  needed: number;
  members: string[];
  sets: number;
  tierLabel?: string;
  slots?: boolean[];
  /** Members that complete the latest set / tier (for power + Golden/Echo checks). */
  setMembers: string[];
}

export interface EvolutionDefinition {
  id: string;
  jokboId: JokboId;
  name: string;
  nameEn: string;
  description: string;
  /** Minimum Jokbo level to be offered. */
  minLevel: number;
  specs: EffectSpec[];
}
