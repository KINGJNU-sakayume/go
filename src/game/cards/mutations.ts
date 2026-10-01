import type { MutationDefinition, MutationId } from '../types';
import { BALANCE } from '../config/balance';

const owner = { owner: true } as const;

/** Card mutations — rarer, transformative changes. Negative ones are curses (Purification removes them). */
export const MUTATIONS: Record<MutationId, MutationDefinition> = {
  monthShift: {
    id: 'monthShift',
    name: '달 바꾸기',
    nameEn: 'Month Shift',
    rarity: 'uncommon',
    description: '인쇄된 달을 영구히 바꿈 (종류는 유지).',
    glyph: '轉',
    negative: false,
    specs: [],
  },
  splitMoon: {
    id: 'splitMoon',
    name: '갈라진 달',
    nameEn: 'Split Moon',
    rarity: 'rare',
    description: '두 번째 달을 추가. 매칭과 점수(족보 칸 채우기) 모두에서 두 달로 취급.',
    glyph: '半',
    negative: false,
    specs: [],
  },
  tripleMoon: {
    id: 'tripleMoon',
    name: '세 겹 달',
    nameEn: 'Triple Moon',
    rarity: 'mythic',
    description: '달을 두 개 더 추가해 세 달로 취급 (매칭 + 점수).',
    glyph: '三',
    negative: false,
    specs: [],
  },
  typeGraft: {
    id: 'typeGraft',
    name: '종류 접목',
    nameEn: 'Type Graft',
    rarity: 'rare',
    description: '점수 종류를 하나 추가 (예: 띠 + 열끗).',
    glyph: '接',
    negative: false,
    specs: [],
  },
  ribbonDye: {
    id: 'ribbonDye',
    name: '띠 염색',
    nameEn: 'Ribbon Dye',
    rarity: 'uncommon',
    description: '띠의 색(홍단/청단/초단)과 그에 맞는 달로 정체성을 바꿈.',
    glyph: '染',
    negative: false,
    specs: [],
  },
  brightAscension: {
    id: 'brightAscension',
    name: '광 승천',
    nameEn: 'Bright Ascension',
    rarity: 'rare',
    description: 'Lv.4 이상 카드가 유사 광이 됨 (광 족보에 포함, 비광 아님).',
    glyph: '昇',
    negative: false,
    specs: [],
  },
  piCompression: {
    id: 'piCompression',
    name: '피 압축',
    nameEn: 'Pi Compression',
    rarity: 'uncommon',
    description: '피 가치 +2 (피가 아니던 카드도 피로 함께 셈).',
    glyph: '壓',
    negative: false,
    specs: [],
  },
  mirror: {
    id: 'mirror',
    name: '거울',
    nameEn: 'Mirror',
    rarity: 'rare',
    description: '획득될 때 함께 먹은 카드(없으면 직전 획득 카드)의 점수 태그를 복사.',
    glyph: '鏡',
    negative: false,
    specs: [
      {
        trigger: 'CARD_CAPTURED',
        conditions: [{ kind: 'subject', filter: owner }],
        effects: [{ kind: 'copyProfile', from: 'partner' }],
        shout: 'MIRROR',
      },
    ],
  },
  parasite: {
    id: 'parasite',
    name: '기생',
    nameEn: 'Parasite',
    rarity: 'uncommon',
    description: `같은 달의 다른 카드가 획득될 때마다 영구히 파워 +${BALANCE.parasitePower}.`,
    glyph: '寄',
    negative: false,
    specs: [
      {
        trigger: 'CARD_CAPTURED',
        conditions: [{ kind: 'custom', id: 'subjectSharesOwnerMonth' }],
        effects: [{ kind: 'gainPower', target: { from: 'owner', pick: 'all' }, value: BALANCE.parasitePower, scope: 'run' }],
        shout: 'PARASITE',
      },
    ],
  },
  rebirth: {
    id: 'rebirth',
    name: '환생',
    nameEn: 'Rebirth',
    rarity: 'rare',
    description: '덱에서 제거되면 Lv+2와 무작위 강화가 붙은 새 카드로 다시 태어남.',
    glyph: '生',
    negative: false,
    specs: [],
  },
  clearSky: {
    id: 'clearSky',
    name: '갠 하늘',
    nameEn: 'Clear Sky',
    rarity: 'rare',
    description: '비광이 더 이상 비광 취급되지 않음 (삼광 감점 없음).',
    glyph: '晴',
    negative: false,
    specs: [],
  },
  withered: {
    id: 'withered',
    name: '시듦',
    nameEn: 'Withered',
    rarity: 'common',
    description: `저주: 파워 ×${BALANCE.witheredPowerMult}, 획득 점수 ×${BALANCE.witheredCaptureMult}.`,
    glyph: '枯',
    negative: true,
    specs: [],
  },
  stubborn: {
    id: 'stubborn',
    name: '고집',
    nameEn: 'Stubborn',
    rarity: 'common',
    description: '저주: 교환할 수 없음.',
    glyph: '頑',
    negative: true,
    specs: [],
  },
  illOmen: {
    id: 'illOmen',
    name: '흉조',
    nameEn: 'Ill Omen',
    rarity: 'common',
    description: `저주: 이 카드가 포함된 족보 ×${BALANCE.illOmenMult}.`,
    glyph: '凶',
    negative: true,
    specs: [
      {
        trigger: 'SCORE_JOKBO',
        conditions: [{ kind: 'member', filter: owner }],
        effects: [{ kind: 'jokboMult', value: BALANCE.illOmenMult }],
      },
    ],
  },
  greedy: {
    id: 'greedy',
    name: '탐욕',
    nameEn: 'Greedy',
    rarity: 'common',
    description: `저주: 획득될 때 엽전 -${BALANCE.greedyCoinLoss}.`,
    glyph: '貪',
    negative: true,
    specs: [
      {
        trigger: 'CARD_CAPTURED',
        conditions: [{ kind: 'subject', filter: owner }],
        effects: [{ kind: 'coins', value: -BALANCE.greedyCoinLoss }],
        shout: '탐욕: 엽전 -2',
      },
    ],
  },
};

export const NEGATIVE_MUTATIONS: MutationId[] = (Object.keys(MUTATIONS) as MutationId[]).filter(
  (id) => MUTATIONS[id].negative,
);

export function getMutation(id: MutationId): MutationDefinition {
  return MUTATIONS[id];
}
