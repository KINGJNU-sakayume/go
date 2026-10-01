import { describe, it } from 'vitest';
import '../index';
import { newRun } from '../engine/run';
import { cloneRun, createStage } from '../engine/stage';
import { addCard, addEnhancement, addMutation, gainTalisman, removeCardFromDeck } from '../engine/operations';
import { STAGES } from '../stages/definitions';
import { botPlayStage } from './bot';
import type { RunState } from '../types';

function cheongdanBuild(seed: string): RunState {
  const run = newRun(seed);
  // thin: remove most pi of irrelevant months and other ribbons
  const keepMonths = ['m06', 'm09', 'm10'];
  for (const c of [...run.deck]) {
    if (run.deck.length <= 30) break;
    const irrelevant = !keepMonths.some((m) => c.defId.startsWith(m)) && c.defId !== 'joker';
    if (irrelevant && (c.defId.includes('pi') || c.defId.includes('ribbon') || c.defId.includes('animal'))) removeCardFromDeck(run, c.uid);
  }
  for (const id of ['m09-ribbon', 'm06-ribbon', 'm10-ribbon']) {
    const base = run.deck.find((c) => c.defId === id)!;
    base.level = 6;
    addEnhancement(base, 'golden');
    addCard(run, id, { level: 4, enhancements: [{ id: 'echo', stacks: 1 }] });
  }
  const sep = run.deck.find((c) => c.defId === 'm09-ribbon')!;
  addMutation(run, sep, { id: 'splitMoon', month: 6 });
  run.jokbo.cheongdan.level = 5;
  run.jokbo.cheongdan.evolutions.push('cheongdan-endless', 'cheongdan-wave');
  run.jokbo.ribbon.level = 3;
  for (const t of ['blue-thread', 'blue-wave', 'light-hand', 'echo-drum', 'broken-mirror', 'emptying', 'sword-cut']) gainTalisman(run, t);
  return run;
}

describe('engineered build', () => {
  it('cheongdan thin-deck engine vs late stages', () => {
    for (const stage of [8, 10, 11]) {
      const scores: number[] = [];
      let best = 0;
      for (let i = 0; i < 40; i++) {
        const run = cloneRun(cheongdanBuild(`B-${i}`));
        createStage(run, stage);
        const done = botPlayStage(run);
        scores.push(done.stageResult!.score);
        best = Math.max(best, done.stats.highestChainScore);
      }
      scores.sort((a, b) => a - b);
      console.log(`stage ${stage + 1} target ${STAGES[stage].target} deck ${cheongdanBuild('x').deck.length}: p10 ${scores[4]} p50 ${scores[20]} p90 ${scores[36]} bestChain ${best}`);
    }
  });
});
