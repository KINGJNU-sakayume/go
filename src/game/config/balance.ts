import type { CardCategory, Rarity, ShopServiceKind, SpecialCaptureKind } from '../types';

/**
 * Balance numbers. The engine reads everything from here or from data definitions,
 * so tuning never requires touching engine code.
 */
export const BALANCE = {
  /** Score per captured card before multipliers (Pi is per Pi value). */
  captureBase: {
    bright: 40,
    animal: 24,
    ribbon: 24,
    pi: 11,
    joker: 15,
  } satisfies Record<CardCategory, number>,

  /** Bonus score for Go-Stop special plays (0 = no score, the play pays 피 or 엽전 instead). */
  specialCapture: {
    jjok: 70,
    ttadak: 100,
    firstTtadak: 0,
    sweep: 180,
    stack: 120,
    ppeokEat: 220,
    firstPpeok: 0,
    chainPpeok: 0,
    triplePpeok: 300,
    bomb: 160,
    chongtong: 300,
  } satisfies Record<SpecialCaptureKind, number>,

  /** 피 뺏기: bonus 피 (counted by the 피 Jokbo) — the table pays 피 for these in the real game. */
  specialPi: {
    jjok: 1,
    ttadak: 1,
    sweep: 1,
    bomb: 1,
    ppeokEat: 2,
  } satisfies Partial<Record<SpecialCaptureKind, number>> as Partial<Record<SpecialCaptureKind, number>>,

  /** 엽전 paid on the spot, like the money 첫뻑 / 연뻑 / 삼뻑 / 첫따닥 collect in the real game. */
  specialCoins: {
    firstTtadak: 3,
    firstPpeok: 3,
    chainPpeok: 5,
    triplePpeok: 10,
  } satisfies Partial<Record<SpecialCaptureKind, number>> as Partial<Record<SpecialCaptureKind, number>>,

  /**
   * 흔들기 / 폭탄: every score after the declaration ×shakeMult per stack. Nothing already on the board
   * is doubled, so when to shake is a real decision (real game: final score ×2).
   */
  shakeMult: 2,
  /** Stacks beyond this no longer multiply (×4 at most). */
  shakeMaxStacks: 2,
  /** 삼뻑 no longer wins outright: it pays this fraction of the stage target (boss stages: the smaller one). */
  triplePpeokTargetFraction: 0.4,
  triplePpeokBossTargetFraction: 0.2,
  /** 고: every GO adds this to the stage multiplier (배) for all later scores, like the real game's 고 점수. */
  goMultAdd: 0.5,

  /** Card power granted by levels: Lv1 0, Lv2 10, Lv3 20, Lv4 30, Lv5 50, then +25 per level. */
  levelPower(level: number): number {
    if (level <= 1) return 0;
    if (level === 2) return 10;
    if (level === 3) return 20;
    if (level === 4) return 30;
    if (level === 5) return 50;
    return 50 + (level - 5) * 25;
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

  stageCoins: [8, 8, 12, 9, 9, 13, 10, 10, 15, 11, 12, 0],
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
    monthDyeExact: 14,
    ribbonDye: 6,
    ribbonDyeExact: 13,
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

  /** Range of the default (rolled) identity operations, in months away from the anchor month. */
  monthRollRange: { shift: [1, 2], split: [1, 2], dual: [2, 3] } as Record<'shift' | 'split' | 'dual', [number, number]>,

  rerollPrice(rerolls: number): number {
    return 2 + rerolls;
  },
} as const;
