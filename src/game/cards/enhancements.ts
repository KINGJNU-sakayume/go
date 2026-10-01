import type { EnhancementDefinition, EnhancementId } from '../types';
import { BALANCE } from '../config/balance';

const owner = { owner: true } as const;

/**
 * Card enhancements. Intrinsic numbers (power, matching) are read by the card view;
 * interactions are expressed as effect specs owned by the card.
 */
export const ENHANCEMENTS: Record<EnhancementId, EnhancementDefinition> = {
  reinforced: {
    id: 'reinforced',
    name: '강화',
    nameEn: 'Reinforced',
    rarity: 'common',
    description: `카드 파워 +${BALANCE.reinforcedPower} (중첩 가능).`,
    glyph: '力',
    color: '#64748b',
    stackable: true,
    specs: [],
  },
  golden: {
    id: 'golden',
    name: '황금',
    nameEn: 'Golden',
    rarity: 'uncommon',
    description: `이 카드가 포함된 족보 점수 ×${BALANCE.goldenMult}.`,
    glyph: '金',
    color: '#d4a017',
    stackable: false,
    specs: [
      {
        trigger: 'SCORE_JOKBO',
        conditions: [{ kind: 'member', filter: owner }],
        effects: [{ kind: 'jokboMult', value: BALANCE.goldenMult }],
      },
    ],
  },
  echo: {
    id: 'echo',
    name: '메아리',
    nameEn: 'Echo',
    rarity: 'rare',
    description: '이 카드가 족보를 완성(또는 단계 상승)시키면 그 족보가 한 번 더 발동.',
    glyph: '響',
    color: '#7c3aed',
    stackable: false,
    specs: [
      {
        trigger: 'JOKBO_TRIGGERED',
        conditions: [
          { kind: 'reason', reasons: ['complete', 'increment'] },
          { kind: 'triggerCard', filter: owner },
        ],
        effects: [{ kind: 'retrigger', target: 'event', times: 1 }],
        shout: 'ECHO!',
      },
    ],
  },
  dualMonth: {
    id: 'dualMonth',
    name: '두 달',
    nameEn: 'Dual Month',
    rarity: 'uncommon',
    description: '두 번째 달로도 짝을 맞출 수 있음 (매칭 전용, 점수 정체성은 유지).',
    glyph: '雙',
    color: '#0891b2',
    stackable: false,
    needsMonth: true,
    specs: [],
  },
  adjacentMonth: {
    id: 'adjacentMonth',
    name: '이웃 달',
    nameEn: 'Adjacent Month',
    rarity: 'common',
    description: '앞뒤 한 달의 카드와도 짝을 맞출 수 있음 (12월↔1월 연결).',
    glyph: '隣',
    color: '#0d9488',
    stackable: false,
    specs: [],
  },
  wildMonth: {
    id: 'wildMonth',
    name: '만월',
    nameEn: 'Wild Month',
    rarity: 'rare',
    description: '어떤 달과도 짝을 맞출 수 있지만 점수 정체성(달·종류)은 그대로.',
    glyph: '萬',
    color: '#9333ea',
    stackable: false,
    specs: [],
  },
  bloom: {
    id: 'bloom',
    name: '개화',
    nameEn: 'Bloom',
    rarity: 'uncommon',
    description: `획득될 때마다 이번 런 동안 영구히 파워 +${BALANCE.bloomPower}.`,
    glyph: '花',
    color: '#db2777',
    stackable: false,
    specs: [
      {
        trigger: 'CAPTURE_RESOLVED',
        conditions: [{ kind: 'subject', filter: owner }],
        effects: [{ kind: 'gainPower', target: { from: 'owner', pick: 'all' }, value: BALANCE.bloomPower, scope: 'run' }],
        shout: 'BLOOM',
      },
    ],
  },
  collector: {
    id: 'collector',
    name: '수집가',
    nameEn: 'Collector',
    rarity: 'common',
    description: `획득될 때 엽전 +${BALANCE.collectorCoins}.`,
    glyph: '錢',
    color: '#ca8a04',
    stackable: false,
    specs: [
      {
        trigger: 'CARD_CAPTURED',
        conditions: [{ kind: 'subject', filter: owner }],
        effects: [{ kind: 'coins', value: BALANCE.collectorCoins }],
        shout: '+엽전',
      },
    ],
  },
  catalyst: {
    id: 'catalyst',
    name: '촉매',
    nameEn: 'Catalyst',
    rarity: 'uncommon',
    description: `이 카드가 발동시킨 족보의 기본 점수 ×${BALANCE.catalystBaseMult}.`,
    glyph: '觸',
    color: '#ea580c',
    stackable: false,
    specs: [
      {
        trigger: 'SCORE_JOKBO',
        conditions: [{ kind: 'triggerCard', filter: owner }],
        effects: [{ kind: 'baseMult', value: BALANCE.catalystBaseMult }],
      },
    ],
  },
  hollow: {
    id: 'hollow',
    name: '공허',
    nameEn: 'Hollow',
    rarity: 'common',
    description: `파워 ×${BALANCE.hollowPowerMult}. 제거·희생되면 엽전 +${BALANCE.hollowRemovalCoins}과 무작위 카드 1장 강화.`,
    glyph: '虛',
    color: '#475569',
    stackable: false,
    specs: [],
  },
  lucky: {
    id: 'lucky',
    name: '행운',
    nameEn: 'Lucky',
    rarity: 'uncommon',
    description: '손에 있는 동안: 더미 맨 위 1장이 보이고, 교환 시 2장을 뽑아 1장을 고름.',
    glyph: '福',
    color: '#16a34a',
    stackable: false,
    specs: [],
  },
  cursed: {
    id: 'cursed',
    name: '저주',
    nameEn: 'Cursed',
    rarity: 'rare',
    description: `파워 +${BALANCE.cursedPower}, 이 카드가 포함된 족보 ×${BALANCE.cursedMult}. 대가: 손에 들어올 때마다 교환 -1.`,
    glyph: '呪',
    color: '#7f1d1d',
    stackable: false,
    mixed: true,
    specs: [
      {
        trigger: 'SCORE_JOKBO',
        conditions: [{ kind: 'member', filter: owner }],
        effects: [{ kind: 'jokboMult', value: BALANCE.cursedMult }],
      },
      {
        trigger: 'STAGE_STARTED',
        conditions: [{ kind: 'custom', id: 'ownerInHand' }],
        effects: [{ kind: 'grantExchange', value: -1 }],
        shout: '저주: 교환 -1',
      },
      {
        trigger: 'CARD_DRAWN',
        conditions: [{ kind: 'subject', filter: owner }],
        effects: [{ kind: 'grantExchange', value: -1 }],
        shout: '저주: 교환 -1',
      },
    ],
  },
};

export const ALL_ENHANCEMENT_IDS = Object.keys(ENHANCEMENTS) as EnhancementId[];

/** Enhancements that can appear as rewards / shop offers / random grants. */
export const POSITIVE_ENHANCEMENTS: EnhancementId[] = ALL_ENHANCEMENT_IDS.filter((id) => id !== 'cursed');

export function getEnhancement(id: EnhancementId): EnhancementDefinition {
  return ENHANCEMENTS[id];
}
