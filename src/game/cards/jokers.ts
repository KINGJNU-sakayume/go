import type { JokerFormDefinition, JokerFormId } from '../types';

const owner = { owner: true } as const;

/**
 * Joker archetypes. Every Joker matches any month when played from hand.
 * When revealed from the stock it is taken immediately as a "service" card and the stock is revealed again.
 */
export const JOKER_FORMS: Record<JokerFormId, JokerFormDefinition> = {
  service: {
    id: 'service',
    name: '서비스 조커',
    nameEn: 'Service Joker',
    rarity: 'common',
    description: '손에서 내면 필드의 어떤 달과도 짝. 획득 시 피 2장. 더미에서 나오면 바로 획득하고 한 장 더 뒤집음.',
    glyph: '鬼',
    color: '#334155',
    piValue: 2,
    specs: [],
  },
  universal: {
    id: 'universal',
    name: '만능 조커',
    nameEn: 'Universal Joker',
    rarity: 'uncommon',
    description: '피 3장. 더미에서 나오면 필드 카드 한 장을 골라 함께 획득.',
    glyph: '全',
    color: '#0f766e',
    piValue: 3,
    specs: [],
  },
  mirror: {
    id: 'mirror',
    name: '거울 조커',
    nameEn: 'Mirror Joker',
    rarity: 'rare',
    description: '획득 시 이번 스테이지에 획득한 카드 중 레벨이 가장 높은 카드의 점수 태그를 복사.',
    glyph: '鏡',
    color: '#6d28d9',
    piValue: 1,
    specs: [
      {
        trigger: 'CARD_CAPTURED',
        conditions: [{ kind: 'subject', filter: owner }],
        effects: [{ kind: 'copyProfile', from: 'highestLevelCaptured' }],
        shout: 'MIRROR JOKER',
      },
    ],
  },
  impostor: {
    id: 'impostor',
    name: '사기꾼 조커',
    nameEn: 'Impostor Joker',
    rarity: 'rare',
    description: '획득 시 완성에 가장 가까운 미완성 세트 족보의 빠진 카드 한 장 행세를 함 (이번 스테이지).',
    glyph: '詐',
    color: '#b45309',
    piValue: 0,
    specs: [
      {
        trigger: 'CARD_CAPTURED',
        conditions: [{ kind: 'subject', filter: owner }],
        effects: [{ kind: 'custom', id: 'impostorAssign' }],
        shout: 'IMPOSTOR',
      },
    ],
  },
  echo: {
    id: 'echo',
    name: '메아리 조커',
    nameEn: 'Echo Joker',
    rarity: 'rare',
    description: '획득 시 가장 최근에 완성된 족보를 한 번 더 발동. 피 1장.',
    glyph: '響',
    color: '#7c3aed',
    piValue: 1,
    specs: [
      {
        trigger: 'CAPTURE_RESOLVED',
        conditions: [{ kind: 'subject', filter: owner }],
        effects: [{ kind: 'retrigger', target: 'lastCompleted', times: 1 }],
        shout: 'ECHO JOKER',
      },
    ],
  },
  moon: {
    id: 'moon',
    name: '달 조커',
    nameEn: 'Moon Joker',
    rarity: 'uncommon',
    description: '덱에서 가장 흔한 달의 카드로 취급 (달 효과·같은 달 족보). 피 2장.',
    glyph: '月',
    color: '#1d4ed8',
    piValue: 2,
    specs: [],
  },
  empty: {
    id: 'empty',
    name: '빈 조커',
    nameEn: 'Empty Joker',
    rarity: 'rare',
    description: '기본 효과가 거의 없음 (피 0). 레벨 파워 ×3, 조커 전용 부적 효과 ×3. 빈 가면이 있으면 강화 효과도 ×3.',
    glyph: '空',
    color: '#94a3b8',
    piValue: 0,
    specs: [],
  },
};

export const ALL_JOKER_FORMS = Object.keys(JOKER_FORMS) as JokerFormId[];

export function getJokerForm(id: JokerFormId): JokerFormDefinition {
  return JOKER_FORMS[id];
}
