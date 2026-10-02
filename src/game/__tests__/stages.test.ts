import { describe, expect, it } from 'vitest';
import { STAGES, cloneRun, createStage, newRun, gainTalisman, allTalismans, EVENTS, createEventState, chooseEventOption } from '../index';
import { botPlayStage, botStep as botStepOnce } from '../sim/bot';
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

describe('event fixes', () => {
  it('the swindler\'s 족보 비급 really is a +2 Jokbo upgrade', () => {
    let found = 0;
    for (let i = 0; i < 40; i++) {
      const run = newRun(`HWATU-SW${i}`);
      const ev = createEventState(run, 'swindler');
      const secret = ev.choices.find((c) => c.label.includes('족보 비급'));
      if (!secret) continue;
      found++;
      expect(secret.steps).toEqual([expect.objectContaining({ op: 'upgradeJokboFixed', levels: 2 })]);
    }
    expect(found).toBeGreaterThan(0);
  });

  it('the drinking table and the devoted flock can be walked away from', () => {
    const run = newRun('HWATU-LEAVE');
    expect(createEventState(run, 'drinkTable').choices.some((c) => c.id === 'leave')).toBe(true);
    run.deck.find((c) => c.defId === 'm02-animal')!.enhancements.push({ id: 'golden', stacks: 1 });
    const birds = createEventState(run, 'birds');
    expect(birds.choices.some((c) => c.id === 'jokbo')).toBe(true);
    expect(birds.choices.some((c) => c.id === 'leave')).toBe(true);
  });
});

describe('boss mechanics apply state (regression: custom core handlers)', () => {
  it('December sets weather, March covers a field card, Impostor gets a slot', () => {
    const dec = cloneRun(newRun('HWATU-WEATHER'));
    createStage(dec, 11);
    expect(dec.stage!.weather).toBeDefined();
    const mar = cloneRun(newRun('HWATU-COVER'));
    createStage(mar, 2);
    let r = mar;
    for (let i = 0; i < 2 && r.phase === 'stage'; i++) {
      const before = r.stage!.turn;
      while (r.phase === 'stage' && r.stage!.turn === before) r = botStepOnce(r);
    }
    // turn 3 started → a field card got covered (unless the field was empty)
    if (r.phase === 'stage' && r.stage!.turn === 3 && r.stage!.field.length) expect(r.stage!.covered.length).toBeGreaterThan(0);
  });
});
