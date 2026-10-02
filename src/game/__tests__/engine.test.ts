import { describe, expect, it } from 'vitest';
import { setupStage, uidOf } from './helpers';
import {
  MemoryStorage,
  clonePerfect,
  cloneBase,
  generateReward,
  loadRun,
  newRun,
  opCandidates,
  playCard,
  pushOp,
  resolveOperation,
  saveRun,
  serializeRun,
  deserializeRun,
  gainTalisman,
  canRemove,
} from '../index';
import { registerTalisman } from '../talismans/registry';
import { botPlayStage } from '../sim/bot';
import type { RunState } from '../types';

/** Hand: September Cheongdan; field: its match; captured already holds June + October Cheongdan. */
function cheongdanSetup(mutate?: (run: RunState) => void): RunState {
  const run = setupStage(
    { hand: ['m09-ribbon', 'm05-pi-a'], field: ['m09-pi-a', 'm07-pi-a'], stock: ['m11-pi-a', 'm11-pi-b', 'm12-doublepi'] },
    mutate,
  );
  const st = run.stage!;
  for (const d of ['m06-ribbon', 'm10-ribbon']) {
    const u = uidOf(run, d);
    st.stock.splice(st.stock.indexOf(u), 1);
    st.captured.push(u);
  }
  return run;
}

describe('jokbo ledger', () => {
  it('scores on completion, not again on every later turn', () => {
    const run = cheongdanSetup();
    const t1 = playCard(run, uidOf(run, 'm09-ribbon'));
    const led = t1.stage!.ledger.cheongdan;
    expect(led.points).toBe(3);
    expect(led.triggers).toBe(1);
    const scoreAfter1 = led.totalScore;
    expect(scoreAfter1).toBeGreaterThan(0);
    // next turn: an unrelated capture must not re-score Cheongdan
    const t2 = playCard(t1, uidOf(run, 'm05-pi-a'));
    expect(t2.stage!.ledger.cheongdan.triggers).toBe(1);
    expect(t2.stage!.ledger.cheongdan.totalScore).toBe(scoreAfter1);
  });
});

describe('retrigger', () => {
  it('Echo on the completing card retriggers the Jokbo once', () => {
    const run = cheongdanSetup((r) => r.deck.find((c) => c.defId === 'm09-ribbon')!.enhancements.push({ id: 'echo', stacks: 1 }));
    const after = playCard(run, uidOf(run, 'm09-ribbon'));
    const led = after.stage!.ledger.cheongdan;
    expect(led.triggers).toBe(2);
    expect(led.retriggers).toBe(1);
    expect(led.totalScore).toBe(led.lastScore * 2);
    const steps = after.stage!.chains.flatMap((c) => c.steps.map((s) => s.title));
    expect(steps).toContain('메아리!');
    expect(steps).toContain('청단 재발동');
  });

  it('Echo Drum adds one extra retrigger to the first retrigger of the stage', () => {
    const run = cheongdanSetup((r) => {
      r.deck.find((c) => c.defId === 'm09-ribbon')!.enhancements.push({ id: 'echo', stacks: 1 });
      gainTalisman(r, 'echo-drum');
    });
    const led = playCard(run, uidOf(run, 'm09-ribbon')).stage!.ledger.cheongdan;
    expect(led.retriggers).toBe(2);
  });
});

describe('talismans', () => {
  it('multiple talismans stack multiplicatively on one Jokbo', () => {
    const base = playCard(cheongdanSetup(), uidOf(cheongdanSetup(), 'm09-ribbon')).stage!.ledger.cheongdan.lastScore;
    const withThread = (() => {
      const r = cheongdanSetup((x) => gainTalisman(x, 'blue-thread'));
      return playCard(r, uidOf(r, 'm09-ribbon')).stage!.ledger.cheongdan.lastScore;
    })();
    const withBoth = (() => {
      const r = cheongdanSetup((x) => {
        gainTalisman(x, 'blue-thread');
        x.deck.find((c) => c.defId === 'm09-ribbon')!.enhancements.push({ id: 'golden', stacks: 1 });
      });
      return playCard(r, uidOf(r, 'm09-ribbon')).stage!.ledger.cheongdan.lastScore;
    })();
    expect(withThread / base).toBeCloseTo(1.5, 1);
    expect(withBoth / base).toBeCloseTo(1.5 * 1.4, 1);
  });

  it('there are 50+ talisman definitions with unique ids', async () => {
    const { TALISMANS } = await import('../index');
    expect(TALISMANS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(TALISMANS.map((t) => t.id)).size).toBe(TALISMANS.length);
  });
});

describe('deck operations', () => {
  it('starting deck: 48 cards + 2 jokers, unique instance ids', () => {
    const run = newRun('HWATU-DECK');
    expect(run.deck).toHaveLength(50);
    expect(new Set(run.deck.map((c) => c.uid)).size).toBe(50);
    expect(run.deck.filter((c) => c.defId === 'joker')).toHaveLength(2);
  });

  it('cloning keeps CardDefinition id but creates a new CardInstance id', () => {
    const run = newRun('HWATU-CLONE');
    const src = run.deck.find((c) => c.defId === 'm09-ribbon')!;
    src.level = 5;
    src.enhancements.push({ id: 'golden', stacks: 1 });
    const base = cloneBase(src, 'c999');
    const exact = clonePerfect(src, 'c1000');
    expect(base.defId).toBe(src.defId);
    expect(base.uid).not.toBe(src.uid);
    expect(base.level).toBe(1);
    expect(base.enhancements).toHaveLength(0);
    expect(exact.uid).not.toBe(src.uid);
    expect(exact.level).toBe(5);
    expect(exact.enhancements).toEqual(src.enhancements);
    exact.enhancements.push({ id: 'echo', stacks: 1 });
    expect(src.enhancements).toHaveLength(1);
  });

  it('duplication via operation adds a physical copy', () => {
    let run = newRun('HWATU-DUP');
    pushOp(run, { kind: 'duplicateCard', title: 't', description: '', source: 'debug', count: 1, cancellable: false, then: [] });
    const uid = run.deck.find((c) => c.defId === 'm09-ribbon')!.uid;
    run = resolveOperation(run, run.ops[0].id, { cardUids: [uid] });
    expect(run.deck.filter((c) => c.defId === 'm09-ribbon')).toHaveLength(2);
    expect(run.deck).toHaveLength(51);
  });

  it('card removal cannot go below the functional minimum', () => {
    let run = newRun('HWATU-REMOVE');
    run.deck = run.deck.slice(0, run.rules.minDeckSize);
    expect(canRemove(run, 1)).toBe(false);
    pushOp(run, { kind: 'removeCard', title: 't', description: '', source: 'debug', count: 1, cancellable: false, then: [] });
    const op = run.ops[0];
    expect(opCandidates(run, op)).toHaveLength(0);
    expect(() => resolveOperation(run, op.id, { cardUids: [run.deck[0].uid] })).toThrow();
    run = newRun('HWATU-REMOVE2');
    pushOp(run, { kind: 'removeCard', title: 't', description: '', source: 'debug', count: 1, cancellable: false, then: [] });
    run = resolveOperation(run, run.ops[0].id, { cardUids: [run.deck[0].uid] });
    expect(run.deck).toHaveLength(49);
  });
});

describe('determinism', () => {
  it('same seed → same shuffle and same reward sequence', () => {
    const a = newRun('HWATU-7K2M9A');
    const b = newRun('HWATU-7K2M9A');
    expect(a.stage!.hand).toEqual(b.stage!.hand);
    expect(a.stage!.stock).toEqual(b.stage!.stock);
    expect(generateReward(a, false, 0)).toEqual(generateReward(b, false, 0));
    const c = newRun('HWATU-OTHER1');
    expect(c.stage!.stock).not.toEqual(a.stage!.stock);
  });

  it('same seed + same actions → identical stage outcome', () => {
    const a = botPlayStage(newRun('HWATU-REPLAY'));
    const b = botPlayStage(newRun('HWATU-REPLAY'));
    expect(a.stageResult).toEqual(b.stageResult);
    expect(a.stage!.captured).toEqual(b.stage!.captured);
  });
});

describe('infinite loop protection', () => {
  it('a self-retriggering effect terminates with 과열 and keeps the score', () => {
    registerTalisman({
      id: 'test-ouroboros',
      number: 999,
      name: '우로보로스 (테스트)',
      nameEn: 'Ouroboros',
      rarity: 'mythic',
      description: 'Every retrigger requests another retrigger (deliberately infinite).',
      tags: ['retrigger'],
      glyph: '∞',
      trigger: 'JOKBO_TRIGGERED',
      conditions: [],
      effects: [{ kind: 'retrigger', target: 'event', times: 1 }],
    });
    const run = cheongdanSetup((r) => gainTalisman(r, 'test-ouroboros'));
    const after = playCard(run, uidOf(run, 'm09-ribbon'));
    const st = after.stage!;
    expect(st.overflowed).toBe(true);
    const chain = st.chains.find((c) => c.overflow)!;
    expect(chain.steps.some((s) => s.title.includes('과열'))).toBe(true);
    expect(chain.resolutions).toBeLessThan(2000);
    expect(st.ledger.cheongdan.retriggers).toBeGreaterThan(3);
    expect(Number.isFinite(st.score)).toBe(true);
    expect(st.score).toBeGreaterThan(0);
    // the turn still completes normally
    expect(st.phase === 'play' || st.phase === 'goStop').toBe(true);
  });
});

describe('save / load', () => {
  it('serializes and restores the run state', () => {
    const run = botPlayStage(newRun('HWATU-SAVE'));
    const restored = deserializeRun(serializeRun(run));
    expect(restored).toEqual(run);
    const storage = new MemoryStorage();
    const fresh = newRun('HWATU-SAVE2');
    expect(saveRun(fresh, storage)).toBe(true);
    expect(loadRun(storage)).toEqual(fresh);
  });

  it('refuses to save in the middle of an unresolved choice', () => {
    const run = setupStage({ hand: ['m01-bright'], field: ['m01-pi-a', 'm01-ribbon'], stock: ['m11-pi-a'] });
    const waiting = playCard(run, uidOf(run, 'm01-bright'));
    expect(waiting.stage!.phase).toBe('chooseHandTarget');
    expect(saveRun(waiting, new MemoryStorage())).toBe(false);
  });
});
