import type { GoHazard, StageDefinition } from '../types';
import { BALANCE } from '../config/balance';

const NORMAL_GO: GoHazard = {
  lineMult: 1.3,
  coinBonusPerGo: BALANCE.goCoinBonus,
  bustCoinLoss: 0,
  description: 'GO: 남은 턴 계속. 새 기준선 = 현재 점수 ×1.3. 기준선 미달로 끝나면 독박 — 이번 스테이지 엽전 보상을 잃음.',
};

const BOSS_GO: GoHazard = {
  lineMult: 1.35,
  coinBonusPerGo: BALANCE.goCoinBonus,
  bustCoinLoss: 0,
  description: 'GO: 새 기준선 = 현재 점수 ×1.35. 독박 시 엽전 보상을 잃음.',
};

/**
 * The 12-month run. Targets, coin rewards and rule twists are data — tune freely.
 * Rule twists pressure builds; none of them turns an archetype off.
 */
export const STAGES: StageDefinition[] = [
  {
    index: 0,
    month: 1,
    name: '새해',
    nameEn: 'New Year',
    boss: false,
    target: 700,
    coinReward: BALANCE.stageCoins[0],
    description: '튜토리얼 스테이지. 짝을 맞추고 족보를 모아 목표 점수를 넘기세요.',
    ruleText: ['첫 짝맞춤 보너스 +150.'],
    modifiers: [
      {
        id: 'new-year',
        name: '새해 첫 짝',
        description: '첫 짝맞춤 +150',
        specs: [
          {
            trigger: 'CARD_MATCHED',
            effects: [{ kind: 'addScore', value: 150, label: '새해 첫 짝' }],
            limit: { perStage: 1 },
            shout: '새해 첫 짝!',
          },
        ],
      },
    ],
    mechanics: {},
    goHazard: NORMAL_GO,
  },
  {
    index: 1,
    month: 2,
    name: '매화 서리',
    nameEn: 'Plum Frost',
    boss: false,
    target: 1000,
    coinReward: BALANCE.stageCoins[1],
    description: '서리가 내린 매화. 짝 없이 내려놓는 패는 얼어붙습니다.',
    ruleText: ['처음으로 짝 없이 내려놓은 손패는 이번 스테이지 동안 파워 ×0.5.'],
    modifiers: [
      {
        id: 'plum-frost',
        name: '매화 서리',
        description: '첫 짝 없는 손패 파워 ×0.5',
        specs: [
          {
            trigger: 'CARD_PLACED',
            conditions: [{ kind: 'custom', id: 'placedFromHand' }],
            effects: [{ kind: 'custom', id: 'plumFrost' }],
            limit: { perStage: 1 },
            shout: '서리!',
          },
        ],
      },
    ],
    mechanics: { firstUnmatchedPowerMult: 0.5 },
    goHazard: NORMAL_GO,
  },
  {
    index: 2,
    month: 3,
    name: '꽃놀이 장막',
    nameEn: 'Flower Curtain',
    boss: true,
    target: 1400,
    coinReward: BALANCE.stageCoins[2],
    description: '보스. 꽃잎 장막이 필드의 카드를 가립니다.',
    ruleText: [
      '3턴마다 필드의 무작위 카드 1장이 장막에 가려짐 (정체 숨김).',
      '같은 달 카드가 나오면 장막이 걷힘. 가려진 카드도 짝맞춤은 그대로 가능.',
    ],
    modifiers: [
      {
        id: 'flower-curtain',
        name: '꽃놀이 장막',
        description: '3턴마다 필드 카드 1장을 가림',
        specs: [
          {
            trigger: 'TURN_STARTED',
            conditions: [{ kind: 'scalar', value: { scalar: 'turn' }, op: 'multipleOf', than: 3 }],
            effects: [{ kind: 'custom', id: 'coverFieldCard' }],
            shout: '장막!',
          },
        ],
      },
    ],
    mechanics: { coverEvery: 3 },
    goHazard: BOSS_GO,
  },
  {
    index: 3,
    month: 4,
    name: '새의 길',
    nameEn: 'Path of Birds',
    boss: false,
    target: 1900,
    coinReward: BALANCE.stageCoins[3],
    description: '새들이 길을 엽니다. 열끗이 빛나고 피는 가벼워집니다.',
    ruleText: ['열끗 획득 점수 ×1.6.', '피 카드 파워 ×0.5, 피 획득 점수 ×0.8.'],
    modifiers: [
      {
        id: 'bird-path',
        name: '새의 길',
        description: '열끗 ×1.6, 피 약화',
        specs: [
          {
            trigger: 'SCORE_CAPTURE',
            conditions: [{ kind: 'subject', filter: { categories: ['animal'] } }],
            effects: [{ kind: 'captureMult', value: 1.6 }],
          },
          {
            trigger: 'SCORE_CAPTURE',
            conditions: [
              { kind: 'subject', filter: { categories: ['pi'] } },
              { kind: 'not', cond: { kind: 'subject', filter: { categories: ['animal'] } } },
            ],
            effects: [{ kind: 'captureMult', value: 0.8 }],
          },
          {
            trigger: 'CARD_POWER',
            conditions: [{ kind: 'subject', filter: { categories: ['pi'] } }],
            effects: [{ kind: 'powerMult', value: 0.5 }],
          },
        ],
      },
    ],
    mechanics: {},
    goHazard: NORMAL_GO,
  },
  {
    index: 4,
    month: 5,
    name: '흔들리는 다리',
    nameEn: 'Swaying Bridge',
    boss: false,
    target: 2600,
    coinReward: BALANCE.stageCoins[4],
    description: '난초 다리가 흔들립니다. 필드의 자리가 바뀌지만 숨겨지는 정보는 없습니다.',
    ruleText: ['2턴마다 필드 카드들의 자리가 뒤섞임 (위치만 바뀌고 카드는 모두 공개).'],
    modifiers: [
      {
        id: 'swaying-bridge',
        name: '흔들리는 다리',
        description: '2턴마다 필드 자리 섞기',
        specs: [
          {
            trigger: 'TURN_STARTED',
            conditions: [{ kind: 'scalar', value: { scalar: 'turn' }, op: 'multipleOf', than: 2 }],
            effects: [{ kind: 'custom', id: 'swayBridge' }],
            shout: '다리가 흔들린다',
          },
        ],
      },
    ],
    mechanics: { fieldSwapEvery: 2 },
    goHazard: NORMAL_GO,
  },
  {
    index: 5,
    month: 6,
    name: '나비 폭풍',
    nameEn: 'Butterfly Storm',
    boss: true,
    target: 3700,
    coinReward: BALANCE.stageCoins[5],
    description: '보스. 나비 떼가 메아리를 흩트립니다.',
    ruleText: ['리트리거가 일어날 때마다 다음 리트리거의 기본 점수가 12%씩 감소 (최저 40%).'],
    modifiers: [],
    mechanics: { retriggerDecay: 0.12 },
    goHazard: BOSS_GO,
  },
  {
    index: 6,
    month: 7,
    name: '멧돼지 숲',
    nameEn: 'Boar Forest',
    boss: false,
    target: 5000,
    coinReward: BALANCE.stageCoins[6],
    description: '멧돼지가 휩쓸고 지나간 숲. 같은 달을 한꺼번에 쓸어 담으세요.',
    ruleText: ['한 턴에 같은 달 카드를 3장 이상 획득하면 3번째부터 장당 +200 콤보 보너스.'],
    modifiers: [
      {
        id: 'boar-forest',
        name: '멧돼지 숲',
        description: '같은 달 대량 획득 콤보',
        specs: [{ trigger: 'CARD_CAPTURED', effects: [{ kind: 'custom', id: 'boarCombo' }] }],
      },
    ],
    mechanics: {},
    goHazard: NORMAL_GO,
  },
  {
    index: 7,
    month: 8,
    name: '달밤',
    nameEn: 'Moonlit Night',
    boss: false,
    target: 7000,
    coinReward: BALANCE.stageCoins[7],
    description: '밝은 달빛 아래 더미의 다음 카드가 비칩니다. 대신 목표가 높습니다.',
    ruleText: ['더미 맨 위 카드 1장이 항상 공개됨.'],
    modifiers: [],
    mechanics: { previewStock: 1 },
    goHazard: NORMAL_GO,
  },
  {
    index: 8,
    month: 9,
    name: '국화주',
    nameEn: 'Chrysanthemum Wine',
    boss: true,
    target: 10000,
    coinReward: BALANCE.stageCoins[8],
    description: '보스. 국화주에 취하면 손패가 뒤섞입니다.',
    ruleText: ['점수가 3번 날 때마다 취기 +1.', '취기 3: 손패 순서가 뒤섞이고 취기 초기화 (카드 정체는 그대로 보임).'],
    modifiers: [],
    mechanics: { drunkEvery: 3 },
    goHazard: BOSS_GO,
  },
  {
    index: 9,
    month: 10,
    name: '낙엽',
    nameEn: 'Fallen Leaves',
    boss: false,
    target: 14500,
    coinReward: BALANCE.stageCoins[9],
    description: '낙엽이 손패를 물들입니다. 교환할수록 강해집니다.',
    ruleText: ['시작 시 교환 +1.', '교환 2번마다 손패 무작위 1장이 이번 스테이지 동안 무작위 강화를 얻음.'],
    modifiers: [
      {
        id: 'fallen-leaves',
        name: '낙엽',
        description: '교환 2번마다 손패 강화',
        specs: [
          { trigger: 'STAGE_STARTED', effects: [{ kind: 'grantExchange', value: 1 }], shout: '낙엽: 교환 +1' },
          {
            trigger: 'EXCHANGE_USED',
            conditions: [{ kind: 'scalar', value: { scalar: 'exchangesUsed' }, op: 'multipleOf', than: 2 }],
            effects: [{ kind: 'tempEnhance', target: { from: 'hand', filter: { joker: false }, pick: 'random' }, enhancement: 'random' }],
            shout: '낙엽이 물든다',
          },
        ],
      },
    ],
    mechanics: { exchangeEnhanceEvery: 2 },
    goHazard: NORMAL_GO,
  },
  {
    index: 10,
    month: 11,
    name: '오동',
    nameEn: 'Paulownia',
    boss: false,
    target: 21000,
    coinReward: BALANCE.stageCoins[10],
    description: '고위험 스테이지. 목표를 넘긴 뒤 GO하면 보상이 크게 불어납니다.',
    ruleText: ['GO 1회마다 엽전 보상 +100% (기본 +50%).', 'GO 성공 시 보상이 희귀 등급으로 상승.', '독박 시 엽전 보상을 잃고 보유 엽전의 30%도 잃음.'],
    modifiers: [],
    mechanics: { goRewardBonus: 0.5 },
    goHazard: {
      lineMult: 1.4,
      coinBonusPerGo: 1.0,
      bustCoinLoss: 0.3,
      description: 'GO: 새 기준선 = 현재 점수 ×1.4. 성공하면 엽전 ×2 이상. 독박이면 보상 상실 + 보유 엽전 30% 상실.',
    },
  },
  {
    index: 11,
    month: 12,
    name: '겨울비',
    nameEn: 'Winter Rain',
    boss: true,
    finalBoss: true,
    target: 32000,
    coinReward: BALANCE.stageCoins[11],
    description: '최종 보스. 2턴마다 날씨가 바뀝니다. 어떤 날씨도 빌드를 끄지는 않습니다.',
    ruleText: ['1·3·5·7턴 시작 시 날씨 변경: 비 / 바람 / 서리 / 맑음.'],
    modifiers: [
      {
        id: 'winter-rain',
        name: '겨울비',
        description: '2턴마다 날씨 변경',
        specs: [
          {
            trigger: 'TURN_STARTED',
            conditions: [{ kind: 'scalar', value: { scalar: 'turn' }, op: 'multipleOf', than: 1 }],
            effects: [{ kind: 'custom', id: 'changeWeather' }],
          },
        ],
      },
    ],
    mechanics: { weatherEvery: 2 },
    goHazard: BOSS_GO,
  },
];

export function getStageDef(index: number): StageDefinition {
  const def = STAGES[index];
  if (!def) throw new Error(`No stage ${index}`);
  return def;
}
