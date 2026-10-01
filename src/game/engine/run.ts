import type { CrossroadsState, JokboId, JokboProgress, RulesConfig, RunState } from '../types';
import { ALL_JOKBO } from '../types';
import { makeRules } from '../config/rules';
import { deriveRng } from '../rng/rng';
import { createStartingDeck } from '../cards/deck';
import { STAGES } from '../stages/definitions';
import { generateReward } from '../rewards/rewards';
import { generateShop } from '../shop/shop';
import { EVENTS, createEventState } from '../events/encounters';
import { runOutcomes } from './operations';
import { cloneRun, createStage } from './stage';

export const SAVE_VERSION = 1;

export function freshJokboProgress(): Record<JokboId, JokboProgress> {
  const out = {} as Record<JokboId, JokboProgress>;
  for (const id of ALL_JOKBO) out[id] = { id, level: 1, evolutions: [], bonusFlat: 0, bonusMultAdd: 0 };
  return out;
}

export function newRun(seed: string, ruleOverrides: Partial<RulesConfig> = {}, now = 0): RunState {
  const rules = makeRules(ruleOverrides);
  const { cards, nextUid } = createStartingDeck(rules);
  const run: RunState = {
    version: SAVE_VERSION,
    seed,
    createdAt: now,
    rules,
    deck: cards,
    nextUid,
    nextOpId: 1,
    startingUids: cards.map((c) => c.uid),
    talismans: [],
    jokbo: freshJokboProgress(),
    coins: 8,
    stageIndex: 0,
    nodeCounter: 0,
    phase: 'stage',
    ops: [],
    removals: 0,
    purchases: 0,
    modifiers: {
      bossTargetMult: 1,
      nextStageExchangeBonus: 0,
      nextStageGlobalAdd: 0,
      nextStageScoreMult: 1,
      permanentGlobalAdd: 0,
      permanentJokboFlat: 0,
    },
    usedEvents: [],
    stats: {
      totalScore: 0,
      highestChainScore: 0,
      highestChainTitle: '',
      longestChain: 0,
      highestEventScore: 0,
      cardsRemoved: 0,
      cardsDuplicated: 0,
      cardsAdded: 0,
      cardsMutated: 0,
      cardsUpgraded: 0,
      jokboTriggers: {},
      bossesDefeated: 0,
      goDecisions: 0,
      goBusts: 0,
      stagesCleared: 0,
      talismansObtained: [],
      overflowCount: 0,
      stageScores: [],
      coinsEarned: 0,
    },
    history: [],
  };
  createStage(run, 0);
  return run;
}

/** From the stage result screen: defeat, victory, or the reward screen. */
export function continueAfterStage(run: RunState): RunState {
  const next = cloneRun(run);
  const result = next.stageResult;
  if (!result) throw new Error('No stage result');
  next.nodeCounter++;
  if (!result.cleared) {
    next.phase = 'defeat';
    return next;
  }
  const def = STAGES[result.stageIndex];
  if (def.finalBoss || result.stageIndex >= STAGES.length - 1) {
    next.phase = 'victory';
    return next;
  }
  const goBonus = result.bust ? 0 : result.goCount;
  next.reward = generateReward(next, def.boss || (def.mechanics.goRewardBonus !== undefined && goBonus > 0), goBonus, result.stageIndex);
  next.phase = 'reward';
  return next;
}

function buildCrossroads(run: RunState): CrossroadsState {
  const rng = deriveRng(run.seed, 'cross', run.stageIndex);
  const unused = EVENTS.filter((e) => !run.usedEvents.includes(e.id));
  const pool = unused.length ? unused : EVENTS;
  const ev = rng.pick(pool);
  return {
    options: [
      { id: 'shop', kind: 'shop', title: '장터 (상점)', description: '카드 제거·강화·복제·변이, 부적과 족보 수련을 엽전으로 산다.' },
      { id: `event-${ev.id}`, kind: 'event', eventId: ev.id, title: ev.name, description: ev.teaser },
    ],
  };
}

export function pickReward(run: RunState, optionId: string): RunState {
  const next = cloneRun(run);
  const reward = next.reward;
  if (!reward || next.phase !== 'reward') throw new Error('No reward to pick');
  const option = reward.options.find((o) => o.id === optionId);
  if (!option) throw new Error('Unknown reward');
  reward.picked = optionId;
  next.history.push({ stageIndex: next.stageIndex, text: `보상: ${option.title}` });
  runOutcomes(next, option.steps);
  next.crossroads = buildCrossroads(next);
  next.phase = 'crossroads';
  return next;
}

export function skipReward(run: RunState): RunState {
  const next = cloneRun(run);
  if (next.phase !== 'reward') throw new Error('No reward to skip');
  next.coins += 3;
  next.history.push({ stageIndex: next.stageIndex, text: '보상 건너뜀 (엽전 +3)' });
  next.crossroads = buildCrossroads(next);
  next.phase = 'crossroads';
  return next;
}

export function chooseCrossroads(run: RunState, optionId: string): RunState {
  const next = cloneRun(run);
  if (next.phase !== 'crossroads' || !next.crossroads) throw new Error('Not at a crossroads');
  if (next.ops.length) throw new Error('먼저 진행 중인 선택을 끝내세요');
  const opt = next.crossroads.options.find((o) => o.id === optionId);
  if (!opt) throw new Error('Unknown path');
  next.nodeCounter++;
  if (opt.kind === 'shop') {
    next.shop = generateShop(next, next.nodeCounter);
    next.phase = 'shop';
  } else {
    next.event = createEventState(next, opt.eventId!);
    next.phase = 'event';
  }
  next.crossroads = undefined;
  return next;
}

export function canAdvance(run: RunState): boolean {
  return run.ops.length === 0;
}

/** Leave the shop / event and start the next month's stage. */
export function advanceToNextStage(run: RunState): RunState {
  if (!canAdvance(run)) throw new Error('먼저 진행 중인 선택을 끝내세요');
  const next = cloneRun(run);
  if (next.event && !next.usedEvents.includes(next.event.eventId)) next.usedEvents.push(next.event.eventId);
  next.shop = undefined;
  next.event = undefined;
  next.reward = undefined;
  next.crossroads = undefined;
  next.nodeCounter++;
  createStage(next, next.stageIndex + 1);
  return next;
}

export function isRunOver(run: RunState): boolean {
  return run.phase === 'victory' || run.phase === 'defeat';
}
