import type { CardCategory, Rarity, ShopServiceKind, SpecialCaptureKind } from '../types';

/**
 * Balance numbers. The engine reads everything from here or from data definitions,
 * so tuning never requires touching engine code.
 */
export const BALANCE = {
  /** Score per captured card before multipliers (Pi is per Pi value). */
  captureBase: {
    bright: 30,
    animal: 18,
    ribbon: 18,
    pi: 9,
    joker: 12,
  } satisfies Record<CardCategory, number>,

  specialCapture: {
    jjok: 70,
    ttadak: 100,
    sweep: 180,
    stack: 120,
    bomb: 160,
    chongtong: 300,
  } satisfies Record<SpecialCaptureKind, number>,

  /** Card power granted by levels: Lv1 0, Lv2 5, Lv3 10, Lv4 15, Lv5 25, then +12 per level. */
  levelPower(level: number): number {
    if (level <= 1) return 0;
    if (level === 2) return 5;
    if (level === 3) return 10;
    if (level === 4) return 15;
    if (level === 5) return 25;
    return 25 + (level - 5) * 12;
  },

  /** Jokbo level multipliers: Lv1 ×1.0 … Lv5 ×3.0, then +0.85 per level. */
  jokboLevelMult(level: number): number {
    const table = [1, 1, 1.35, 1.75, 2.25, 3.0];
    if (level <= 5) return table[Math.max(1, level)];
    return 3.0 + (level - 5) * 0.85;
  },

  /** Levels at which a Jokbo offers an evolution choice. */
  evolutionLevels: [3, 5, 7] as const,
  /** Card levels at which a minor enhancement choice is offered. */
  cardEnhancementLevels: [4] as const,
  /** Card levels at which a special upgrade (enhancement or mutation) is offered. */
  cardSpecialLevels: [6, 8, 10, 12, 14, 16] as const,

  reinforcedPower: 10,
  goldenMult: 1.4,
  catalystBaseMult: 1.5,
  bloomPower: 3,
  parasitePower: 3,
  collectorCoins: 2,
  hollowPowerMult: 0.5,
  hollowRemovalCoins: 6,
  cursedPower: 30,
  cursedMult: 1.3,
  witheredPowerMult: 0.25,
  witheredCaptureMult: 0.5,
  illOmenMult: 0.75,
  greedyCoinLoss: 2,

  stageCoins: [6, 6, 9, 7, 7, 11, 8, 8, 13, 9, 10, 0],
  overkillCoinStep: 0.25,
  overkillCoinMax: 8,
  goCoinBonus: 0.5,

  removalPrice(count: number): number {
    return 3 + Math.floor(count / 2);
  },

  servicePrice: {
    removal: 3,
    upgrade: 5,
    mutation: 9,
    duplicate: 6,
    perfectClone: 14,
    jokboTraining: 7,
    talisman: 6,
    jokerWorkshop: 9,
    monthDye: 6,
    ribbonDye: 6,
    purify: 4,
    enhancement: 7,
    addJoker: 8,
  } satisfies Record<ShopServiceKind, number>,

  talismanPrice: {
    common: 5,
    uncommon: 8,
    rare: 12,
    mythic: 18,
  } satisfies Record<Rarity, number>,

  rerollPrice(rerolls: number): number {
    return 2 + rerolls;
  },
} as const;
