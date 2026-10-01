import type {
  EnhancementId,
  JokboId,
  Rarity,
  RewardKind,
  RewardOption,
  RewardState,
  RunState,
  TalismanDefinition,
} from '../types';
import { ALL_JOKBO } from '../types';
import { BALANCE } from '../config/balance';
import { Rng, deriveRng } from '../rng/rng';
import { ENHANCEMENTS } from '../cards/enhancements';
import { JOKBO_DEFS } from '../jokbo/definitions';
import { allTalismans } from '../talismans/registry';

export function talismanRarityWeights(stageIndex: number, bump: number): Record<Rarity, number> {
  const t = Math.min(1, stageIndex / 10) + bump * 0.35;
  return {
    common: Math.max(0.05, 0.6 - 0.4 * t),
    uncommon: 0.32 + 0.05 * t,
    rare: 0.07 + 0.3 * t,
    mythic: 0.01 + 0.08 * t,
  };
}

/** Pick a talisman not yet owned. Talismans sharing tags with owned ones are slightly favoured. */
export function rollTalisman(run: RunState, rng: Rng, weights: Record<Rarity, number>, exclude: string[] = []): TalismanDefinition | undefined {
  const owned = new Set([...run.talismans.map((t) => t.id), ...exclude]);
  const ownedTags = new Set(
    run.talismans.flatMap((t) => allTalismans().find((d) => d.id === t.id)?.tags ?? []),
  );
  const pool = allTalismans().filter((t) => !owned.has(t.id));
  if (!pool.length) return undefined;
  return rng.weighted(
    pool.map((t) => ({
      item: t,
      weight: weights[t.rarity] * (t.tags.some((g) => ownedTags.has(g)) ? 1.5 : 1),
    })),
  );
}

export function jokboUpgradePreview(run: RunState, j: JokboId, levels: number): string {
  const lv = run.jokbo[j].level;
  return `${JOKBO_DEFS[j].name} Lv.${lv} → Lv.${lv + levels} · ×${BALANCE.jokboLevelMult(lv).toFixed(2)} → ×${BALANCE.jokboLevelMult(lv + levels).toFixed(2)}`;
}

function pickJokbo(run: RunState, rng: Rng): JokboId {
  // Favour Jokbo the player actually triggers.
  return rng.weighted(
    ALL_JOKBO.map((j) => ({ item: j, weight: 1 + Math.min(6, (run.stats.jokboTriggers[j] ?? 0) * 0.5) + run.jokbo[j].level * 0.5 })),
  );
}

const NORMAL_ENH: EnhancementId[] = ['reinforced', 'golden', 'dualMonth', 'adjacentMonth', 'bloom', 'collector', 'catalyst', 'lucky', 'hollow'];
const RARE_ENH: EnhancementId[] = ['echo', 'golden', 'wildMonth', 'catalyst'];

interface Candidate {
  kind: RewardKind;
  weight: number;
  build: () => RewardOption | undefined;
}

export function generateReward(run: RunState, boss: boolean, goCount: number, salt: string | number = run.stageIndex): RewardState {
  const rng = deriveRng(run.seed, 'reward', salt);
  const bump = goCount + (boss ? 1 : 0);
  const premium = boss || goCount >= 2;
  const weights = talismanRarityWeights(run.stageIndex, bump);
  const usedTalismans: string[] = [];
  let n = 0;
  const id = () => `r${n++}`;

  const candidates: Candidate[] = [
    {
      kind: 'talisman',
      weight: 3,
      build: () => {
        const t = rollTalisman(run, rng, premium ? { common: 0, uncommon: 0.3, rare: 0.55, mythic: 0.15 } : weights, usedTalismans);
        if (!t) return undefined;
        usedTalismans.push(t.id);
        return {
          id: id(),
          kind: 'talisman',
          title: `부적: ${t.name}`,
          description: t.description,
          rarity: t.rarity,
          talismanId: t.id,
          steps: [{ op: 'gainTalisman', talismanId: t.id }],
        };
      },
    },
    {
      kind: 'upgradeCard',
      weight: 2.5,
      build: () => {
        const levels = premium ? 3 : rng.chance(0.25 + bump * 0.15) ? 2 : 1;
        return {
          id: id(),
          kind: 'upgradeCard',
          title: `카드 강화 +${levels}`,
          description: `카드 한 장의 레벨 +${levels} (Lv.4에서 강화 선택, Lv.6부터 특별 강화).`,
          rarity: levels >= 3 ? 'rare' : levels === 2 ? 'uncommon' : 'common',
          steps: [
            {
              op: 'interactive',
              operation: { kind: 'upgradeCard', title: `카드 강화 +${levels}`, description: '강화할 카드를 고르세요.', source: 'reward', count: 1, levels, cancellable: false },
            },
          ],
        };
      },
    },
    {
      kind: 'removeCard',
      weight: 2,
      build: () => {
        const count = premium ? 3 : rng.chance(0.35) ? 2 : 1;
        if (run.deck.length - count < run.rules.minDeckSize) return undefined;
        return {
          id: id(),
          kind: 'removeCard',
          title: `카드 제거 ×${count}`,
          description: `덱에서 카드 ${count}장을 영구히 제거 (최소 ${run.rules.minDeckSize}장).`,
          rarity: count >= 3 ? 'rare' : count === 2 ? 'uncommon' : 'common',
          steps: [
            {
              op: 'interactive',
              operation: { kind: 'removeCard', title: `카드 제거 ×${count}`, description: '제거할 카드를 고르세요.', source: 'reward', count, cancellable: false },
            },
          ],
        };
      },
    },
    {
      kind: 'duplicateCard',
      weight: premium ? 0 : 1.5,
      build: () => ({
        id: id(),
        kind: 'duplicateCard',
        title: '카드 복제',
        description: '카드 한 장의 기본형(Lv.1, 강화 없음)을 덱에 추가.',
        rarity: 'uncommon',
        steps: [
          {
            op: 'interactive',
            operation: { kind: 'duplicateCard', title: '카드 복제', description: '복제할 카드를 고르세요.', source: 'reward', count: 1, cancellable: false },
          },
        ],
      }),
    },
    {
      kind: 'perfectClone',
      weight: premium ? 1.5 : 0.25,
      build: () => ({
        id: id(),
        kind: 'perfectClone',
        title: '완전 복제',
        description: '레벨·강화·변이까지 그대로 복제.',
        rarity: 'rare',
        steps: [
          {
            op: 'interactive',
            operation: { kind: 'perfectClone', title: '완전 복제', description: '완전히 복제할 카드를 고르세요.', source: 'reward', count: 1, cancellable: false },
          },
        ],
      }),
    },
    {
      kind: 'enhanceCard',
      weight: 2,
      build: () => {
        const enh = rng.pick(premium ? RARE_ENH : NORMAL_ENH);
        const def = ENHANCEMENTS[enh];
        return {
          id: id(),
          kind: 'enhanceCard',
          title: `강화: ${def.name}`,
          description: def.description,
          rarity: def.rarity,
          enhancement: enh,
          steps: [
            {
              op: 'interactive',
              operation: {
                kind: 'enhanceCard',
                title: `강화: ${def.name}`,
                description: '강화를 붙일 카드를 고르세요.',
                source: 'reward',
                count: 1,
                enhancement: enh,
                cancellable: false,
              },
            },
          ],
        };
      },
    },
    {
      kind: 'upgradeJokbo',
      weight: 2,
      build: () => {
        const j = pickJokbo(run, rng);
        const levels = premium ? 2 : 1;
        return {
          id: id(),
          kind: 'upgradeJokbo',
          title: `족보 수련: ${JOKBO_DEFS[j].name} +${levels}`,
          description: JOKBO_DEFS[j].description,
          rarity: premium ? 'rare' : 'uncommon',
          jokboId: j,
          preview: jokboUpgradePreview(run, j, levels),
          steps: [{ op: 'upgradeJokboFixed', jokboId: j, levels }],
        };
      },
    },
    {
      kind: 'mutateCard',
      weight: premium ? 2 : 1,
      build: () => ({
        id: id(),
        kind: 'mutateCard',
        title: '카드 변이',
        description: '카드 한 장을 골라 변이 3개 중 하나를 선택.',
        rarity: 'rare',
        steps: [
          {
            op: 'interactive',
            operation: { kind: 'mutateCard', title: '카드 변이', description: '변이시킬 카드를 고르세요.', source: 'reward', count: 1, cancellable: false },
          },
        ],
      }),
    },
    {
      kind: 'addJoker',
      weight: 0.6,
      build: () => {
        const form = premium ? rng.pick(['mirror', 'echo', 'impostor', 'universal', 'moon'] as const) : 'service';
        return {
          id: id(),
          kind: 'addJoker',
          title: form === 'service' ? '조커 추가' : '특수 조커 추가',
          description: form === 'service' ? '서비스 조커 1장을 덱에 추가.' : `${form} 조커 1장을 덱에 추가.`,
          rarity: form === 'service' ? 'uncommon' : 'rare',
          steps: [{ op: 'addJoker', form }],
        };
      },
    },
    {
      kind: 'jokerWorkshop',
      weight: run.deck.some((c) => c.defId === 'joker') ? (premium ? 1.2 : 0.4) : 0,
      build: () => ({
        id: id(),
        kind: 'jokerWorkshop',
        title: '조커 공방',
        description: '조커 한 장을 특수 조커로 변신.',
        rarity: 'rare',
        steps: [
          {
            op: 'interactive',
            operation: { kind: 'jokerWorkshop', title: '조커 공방', description: '변신시킬 조커를 고르세요.', source: 'reward', count: 1, cancellable: false },
          },
        ],
      }),
    },
    {
      kind: 'coins',
      weight: 1,
      build: () => {
        const amount = 8 + rng.int(5) + bump * 3;
        return {
          id: id(),
          kind: 'coins',
          title: `엽전 ${amount}`,
          description: '상점에서 쓸 엽전.',
          rarity: 'common',
          steps: [{ op: 'gainCoins', amount }],
        };
      },
    },
  ];

  const options: RewardOption[] = [];
  const usedKinds = new Set<RewardKind>();
  let guard = 0;
  while (options.length < 3 && guard++ < 50) {
    const available = candidates.filter((c) => c.weight > 0 && !usedKinds.has(c.kind));
    if (!available.length) break;
    const pick = rng.weighted(available.map((c) => ({ item: c, weight: c.weight })));
    usedKinds.add(pick.kind);
    const opt = pick.build();
    if (opt) options.push(opt);
  }
  return { options, boss };
}
