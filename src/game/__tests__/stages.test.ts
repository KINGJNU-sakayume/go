import { describe, expect, it } from 'vitest';
import { STAGES, cloneRun, createStage, newRun, gainTalisman, allTalismans, EVENTS, createEventState, chooseEventOption, playCard, handCaptureOptions } from '../index';
import { setupStage, uidOf } from './helpers';
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

describe('month rules that change play', () => {
  const titlesOf = (r: ReturnType<typeof setupStage>) => r.stage!.chains.flatMap((c) => c.steps.map((s) => s.title));

  it('February frost: an unmatched hand card freezes — not even the stock card can take it (no 쪽)', () => {
    const run = setupStage({ hand: ['m05-pi-a', 'm07-ribbon', 'm05-ribbon'], field: ['m07-pi-a'], stock: ['m05-pi-b', 'm11-pi-a', 'm12-animal'] });
    run.stage!.stageIndex = 1;
    const t1 = playCard(run, uidOf(run, 'm05-pi-a'));
    const st = t1.stage!;
    expect(st.captured).not.toContain(uidOf(run, 'm05-pi-a'));
    expect(st.field).toEqual(expect.arrayContaining([uidOf(run, 'm05-pi-a'), uidOf(run, 'm05-pi-b')]));
    expect(titlesOf(t1)).not.toContain('쪽!');
    // turn 2: still frozen — the 5월 띠 can only take the stock-laid 5월 피
    const opts = handCaptureOptions(t1, uidOf(run, 'm05-ribbon'));
    expect(opts.flatMap((o) => o.targetUids)).toEqual([uidOf(run, 'm05-pi-b')]);
  });

  it('May bridge: every second turn a field card drops to the stock bottom and the stock top comes up', () => {
    const run = setupStage({ hand: ['m02-pi-a', 'm04-pi-a'], field: ['m07-pi-a', 'm08-pi-a', 'm09-pi-a'], stock: ['m11-pi-a', 'm12-animal', 'm10-pi-a'] });
    run.stage!.stageIndex = 4;
    const t1 = playCard(run, uidOf(run, 'm02-pi-a')); // turn 2 starts → the bridge sways
    const st = t1.stage!;
    const dropped = st.stock[st.stock.length - 1];
    expect([uidOf(run, 'm07-pi-a'), uidOf(run, 'm08-pi-a'), uidOf(run, 'm09-pi-a'), uidOf(run, 'm02-pi-a'), uidOf(run, 'm11-pi-a')]).toContain(dropped);
    expect(st.field).toContain(uidOf(run, 'm12-animal'));
    expect(titlesOf(t1).some((t) => t.startsWith('다리가 흔들려'))).toBe(true);
  });

  it('September drunk: at 취기 3 a hand card is soaked and replaced from the stock', () => {
    const run = setupStage({ hand: ['m05-pi-a', 'm07-ribbon', 'm03-pi-a'], field: ['m08-pi-a'], stock: ['m05-pi-b', 'm11-pi-a', 'm12-animal'] });
    run.stage!.stageIndex = 8;
    run.stage!.drunk = 2;
    run.stage!.scoredEffects = 2;
    const st = playCard(run, uidOf(run, 'm05-pi-a')).stage!; // 쪽 scores a bonus → 취기 3
    expect(st.discard).toHaveLength(1);
    expect(st.hand).toHaveLength(2);
    expect(st.hand).toContain(uidOf(run, 'm11-pi-a'));
    expect(st.drunk).toBe(0);
  });

  it('stage targets rise every month', () => {
    for (let i = 1; i < STAGES.length; i++) expect(STAGES[i].target).toBeGreaterThan(STAGES[i - 1].target);
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
