import type { RulesConfig } from '../types';

/** Default rule configuration. Every number here is a tuning knob, not a sacred value. */
export const DEFAULT_RULES: RulesConfig = {
  handSize: 8,
  fieldSize: 8,
  turnsPerStage: 8,
  exchangesPerStage: 2,
  jokerCount: 2,
  minDeckSize: 24,
  pointValue: 100,
  rainRibbonCountsAsRibbon: true,
  mayAnimalDoublePi: false,
  septemberAnimalDoublePi: false,
  jokerPiValue: 2,
  doublePiValue: 2,
  rainBrightPenalty: true,
  wrapAdjacentMonths: true,
  adjacentRange: 1,
  basePreview: 0,
  goEnabled: true,
  ppeok: true,
  shake: true,
  piSteal: true,
  maxChainResolutions: 240,
  maxChainDepth: 48,
  loopRepeatLimit: 16,
};

export function makeRules(overrides: Partial<RulesConfig> = {}): RulesConfig {
  return { ...DEFAULT_RULES, ...overrides };
}
