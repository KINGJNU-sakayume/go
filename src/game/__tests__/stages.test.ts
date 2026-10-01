import { describe, expect, it } from 'vitest';
import { STAGES, cloneRun, createStage, newRun, gainTalisman, allTalismans, EVENTS, createEventState, chooseEventOption } from '../index';
import { botPlayStage } from '../sim/bot';
import { botPlayRun } from '../sim/runBot';

describe('all 12 stages', () => {
  it('every month stage (and boss rule) plays to a result', () => {
    for (const def of STAGES) {
      for (const seed of ['A', 'B', 'C']) {
        const run = cloneRun(newRun(`HWATU-ST${seed}`));
        createStage(run, def.index);
        const done = botPlayStage(run, { go: true });
        expect(done.phase).toBe('stageResult');
        expect(done.stageResult!.score).toBeGreaterThan(0);
      }
    }
  });

  it('a run with every talisman owned still resolves (no crashes in effects)', () => {
    const run = newRun('HWATU-ALLTAL');
    for (const t of allTalismans()) if (!t.id.startsWith('test-')) gainTalisman(run, t.id);
    for (const idx of [0, 5, 8, 11]) {
      const r = cloneRun(run);
      createStage(r, idx);
      expect(botPlayStage(r, { go: true }).phase).toBe('stageResult');
    }
  });

  it('full runs progress through rewards, shops and events', () => {
    for (let i = 0; i < 5; i++) {
      const res = botPlayRun(newRun(`HWATU-FULL${i}`));
      expect(res.reached).toBeGreaterThanOrEqual(0);
    }
  });

  it('every event can be set up and every enabled choice resolved', () => {
    for (const ev of EVENTS) {
      const run = newRun(`HWATU-EV-${ev.id}`);
      run.coins = 50;
      run.deck[5].enhancements.push({ id: 'golden', stacks: 1 });
      run.phase = 'event';
      run.event = createEventState(run, ev.id);
      for (const c of run.event.choices) {
        if (c.disabled) continue;
        const after = chooseEventOption(run, c.id);
        expect(after.coins).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
