import type { GoHazard, StageDefinition } from '../types';
import { BALANCE } from '../config/balance';

const NORMAL_GO: GoHazard = {
  lineMult: 1.3,
  coinBonusPerGo: BALANCE.goCoinBonus,
  bustCoinLoss: 0,
  description: '고: 남은 턴 계속. 새 기준선 = 현재 점수 ×1.3. 기준선 미달로 끝나면 독박 — 이번 스테이지 엽전 보상을 잃음.',
};

const BOSS_GO: GoHazard = {
  lineMult: 1.35,
  coinBonusPerGo: BALANCE.goCoinBonus,
  bustCoinLoss: 0,
  description: '고: 새 기준선 = 현재 점수 ×1.35. 독박 시 엽전 보상을 잃음.',
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
    target: 540,
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
    target: 800,
    coinReward: BALANCE.stageCoins[1],
    description: '서리가 내린 매화. 짝 없이 내려놓는 패는 얼어붙습니다.',
    ruleText: ['짝 없이 내려놓은 손패(스테이지당 처음 2장)는 얼어붙어 그 턴과 다음 턴 동안 어떤 패로도 먹을 수 없음 (쪽 불가).'],
    modifiers: [
      {
        id: 'plum-frost',
        name: '매화 서리',
        description: '짝 없이 놓은 손패가 2턴 동안 얼어붙음',
        specs: [
          {
            trigger: 'CARD_PLACED',
            conditions: [{ kind: 'custom', id: 'placedFromHand' }],
            effects: [{ kind: 'custom', id: 'plumFrost' }],
            limit: { perStage: 2 },
            shout: '서리!',
          },
        ],
      },
    ],
    mechanics: { frostTurns: 2 },
    goHazard: NORMAL_GO,
  },
  {
    index: 2,
    month: 3,
    name: '꽃놀이 장막',
    nameEn: 'Flower Curtain',
    boss: true,
    target: 1250,
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
    target: 1700,
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
    target: 2300,
    coinReward: BALANCE.stageCoins[4],
    description: '난초 다리가 흔들립니다. 노리던 바닥 패가 다리 아래로 떨어질 수 있습니다.',
    ruleText: ['2턴마다 바닥의 무작위 카드 1장이 다리 아래(더미 맨 밑)로 떨어지고, 더미 맨 위 카드가 그 자리에 올라옴.'],
    modifiers: [
      {
        id: 'swaying-bridge',
        name: '흔들리는 다리',
        description: '2턴마다 바닥 카드 1장이 더미 패와 바뀜',
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
    mechanics: { bridgeDropEvery: 2 },
    goHazard: NORMAL_GO,
  },
  {
    index: 5,
    month: 6,
    name: '나비 폭풍',
    nameEn: 'Butterfly Storm',
    boss: true,
    target: 2900,
    coinReward: BALANCE.stageCoins[5],
    description: '보스. 나비 떼가 메아리를 흩트립니다.',
    ruleText: ['재발동이 일어날 때마다 다음 재발동의 기본 점수가 12%씩 감소 (최저 40%).'],
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
    target: 4000,
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
    target: 5600,
    coinReward: BALANCE.stageCoins[7],
    description: '숨 고르는 달. 밝은 달빛 아래 더미의 다음 카드가 비칩니다 — 다음 달 보스를 위해 빌드를 다듬을 기회.',
    ruleText: ['더미 맨 위 카드 1장이 항상 공개됨 (쉬어 가는 스테이지: 불리한 규칙 없음).'],
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
    target: 8500,
    coinReward: BALANCE.stageCoins[8],
    description: '보스. 국화주에 취하면 아끼던 손패를 흘려버립니다.',
    ruleText: ['족보·보너스 점수가 3번 날 때마다 취기 +1.', '취기 3: 손패 무작위 1장이 술에 젖어 버려지고 더미에서 1장을 새로 받음 (교환 횟수는 그대로, 취기 초기화).'],
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
    target: 13000,
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
    target: 20000,
    coinReward: BALANCE.stageCoins[10],
    description: '고위험 스테이지. 목표를 넘긴 뒤 고를 외치면 보상이 크게 불어납니다.',
    ruleText: ['고 1회마다 엽전 보상 +100% (기본 +50%).', '고 성공 시 보상이 희귀 등급으로 상승.', '독박 시 엽전 보상을 잃고 보유 엽전의 30%도 잃음.'],
    modifiers: [],
    mechanics: { goRewardBonus: 0.5 },
    goHazard: {
      lineMult: 1.4,
      coinBonusPerGo: 1.0,
      bustCoinLoss: 0.3,
      description: '고: 새 기준선 = 현재 점수 ×1.4. 성공하면 엽전 ×2 이상. 독박이면 보상 상실 + 보유 엽전 30% 상실.',
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
