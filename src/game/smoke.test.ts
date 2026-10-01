import { describe, expect, it } from 'vitest';
import { newRun } from './index';
import { botPlayStage } from './sim/bot';

describe('smoke', () => {
  it('plays the January stage to a result', () => {
    const run = newRun('HWATU-SMOKE1');
    expect(run.stage?.hand.length).toBe(8);
    expect(run.stage?.field.length).toBe(8);
    const done = botPlayStage(run);
    expect(done.phase).toBe('stageResult');
    console.log('score', done.stageResult?.score, 'target', done.stageResult?.target, 'chains', done.stage?.chains.length);
    for (const c of done.stage!.chains.slice(0, 6)) {
      console.log('---', c.title, c.totalScore);
      for (const s of c.steps) console.log('  '.repeat(Math.min(4, s.depth)), s.kind, s.title, s.value ?? '', s.detail ?? '');
    }
  });
});
