import { describe, it } from 'vitest';
import '../index';
import { newRun } from '../engine/run';
import { createStage, cloneRun } from '../engine/stage';
import { STAGES } from '../stages/definitions';
import { botPlayStage } from './bot';

function pct(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

describe('balance (base deck, greedy bot)', () => {
  it('score distribution per stage', () => {
    const N = Number(process.env.SIM_N ?? 150);
    for (let stage = 0; stage < 4; stage++) {
      const scores: number[] = [];
      let cleared = 0;
      for (let i = 0; i < N; i++) {
        const base = newRun(`SIM-${i}`);
        const run = cloneRun(base);
        createStage(run, stage);
        const done = botPlayStage(run);
        scores.push(done.stageResult!.score);
        if (done.stageResult!.cleared) cleared++;
      }
      console.log(
        `stage ${stage + 1} (${STAGES[stage].name}) target ${STAGES[stage].target}: p10 ${pct(scores, 0.1)} p50 ${pct(scores, 0.5)} p90 ${pct(scores, 0.9)} clear ${(cleared / N * 100).toFixed(0)}%`,
      );
    }
  });
});

import { botPlayRun } from './runBot';
describe('full runs (greedy bot)', () => {
  it('how far does a simple bot get', () => {
    const N = Number(process.env.SIM_RUNS ?? 60);
    const reached = new Array(13).fill(0);
    const scoreByStage: number[][] = Array.from({ length: 12 }, () => []);
    for (let i = 0; i < N; i++) {
      const r = botPlayRun(newRun(`RUN-${i}`));
      reached[r.reached]++;
      r.scores.forEach((s, k) => s !== undefined && scoreByStage[k].push(s));
    }
    console.log('stages cleared distribution', reached.join(' '));
    scoreByStage.forEach((arr, k) => arr.length && console.log(`stage ${k + 1} n=${arr.length} p50 ${pct(arr, 0.5)} p90 ${pct(arr, 0.9)} target ${STAGES[k].target}`));
  });
});
