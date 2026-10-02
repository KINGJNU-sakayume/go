import { describe, expect, it } from 'vitest';
import { setupStage, uidOf, profilesFor } from './helpers';
import {
  JOKBO_DEFS,
  canMatch,
  chooseTarget,
  evaluateJokbo,
  identityOf,
  makeContext,
  maxDisjointSets,
  newRun,
  playCard,
  Rng,
} from '../index';
import type { JokboId, RunState } from '../types';

function ctxOf(run: RunState) {
  return makeContext(run, run.stage, new Rng([1, 2, 3, 4]));
}
const evalRules = { rainBrightPenalty: true };
function points(run: RunState, id: JokboId, defIds: string[], rules = evalRules) {
  return evaluateJokbo(JOKBO_DEFS[id], profilesFor(run, defIds), rules).points;
}

describe('matching', () => {
  it('same-month capture takes both cards', () => {
    const run = setupStage({ hand: ['m01-bright', 'm05-pi-a'], field: ['m01-pi-a', 'm07-pi-a'], stock: ['m11-pi-a'] });
    const bright = uidOf(run, 'm01-bright');
    const after = playCard(run, bright);
    const st = after.stage!;
    expect(st.captured).toContain(bright);
    expect(st.captured).toContain(uidOf(run, 'm01-pi-a'));
    expect(st.field).not.toContain(uidOf(run, 'm01-pi-a'));
    // unmatched stock card goes to the field
    expect(st.field).toContain(uidOf(run, 'm11-pi-a'));
  });

  it('unmatched play stays on the field', () => {
    const run = setupStage({ hand: ['m05-pi-a'], field: ['m01-pi-a'], stock: ['m11-pi-a'] });
    const after = playCard(run, uidOf(run, 'm05-pi-a'));
    expect(after.stage!.field).toContain(uidOf(run, 'm05-pi-a'));
  });

  it('multiple same-month targets let the player choose', () => {
    const run = setupStage({ hand: ['m01-bright'], field: ['m01-pi-a', 'm01-ribbon', 'm07-pi-a'], stock: ['m11-pi-a'] });
    const waiting = playCard(run, uidOf(run, 'm01-bright'));
    expect(waiting.stage!.phase).toBe('chooseHandTarget');
    const opts = waiting.stage!.pending!.options;
    expect(opts).toHaveLength(2);
    const ribbonOpt = opts.find((o) => o.targetUids[0] === uidOf(run, 'm01-ribbon'))!;
    const done = chooseTarget(waiting, ribbonOpt.id);
    expect(done.stage!.captured).toContain(uidOf(run, 'm01-ribbon'));
    expect(done.stage!.field).toContain(uidOf(run, 'm01-pi-a'));
  });

  it('three of a month on the field are swept together (stack)', () => {
    const run = setupStage({ hand: ['m01-bright'], field: ['m01-pi-a', 'm01-pi-b', 'm01-ribbon'], stock: ['m11-pi-a'] });
    const done = playCard(run, uidOf(run, 'm01-bright'));
    expect(done.stage!.captured).toHaveLength(4);
  });

  it('Dual Month matches either month but keeps scoring identity', () => {
    const run = setupStage({ hand: ['m09-ribbon'], field: ['m06-pi-a'], stock: ['m11-pi-a'] }, (r) => {
      r.deck.find((c) => c.defId === 'm09-ribbon')!.enhancements.push({ id: 'dualMonth', stacks: 1, month: 6 });
    });
    const ctx = ctxOf(run);
    const card = identityOf(ctx, uidOf(run, 'm09-ribbon'));
    expect(card.scoringMonths).toEqual([9]);
    expect(canMatch(card, identityOf(ctx, uidOf(run, 'm06-pi-a')))).toBe(true);
    expect(canMatch(card, identityOf(ctx, uidOf(run, 'm09-pi-a')))).toBe(true);
    expect(canMatch(card, identityOf(ctx, uidOf(run, 'm03-pi-a')))).toBe(false);
  });

  it('Wild Month matches anything while scoring identity stays', () => {
    const run = setupStage({ hand: ['m09-ribbon'], field: ['m03-pi-a'], stock: ['m11-pi-a'] }, (r) => {
      r.deck.find((c) => c.defId === 'm09-ribbon')!.enhancements.push({ id: 'wildMonth', stacks: 1 });
    });
    const ctx = ctxOf(run);
    const card = identityOf(ctx, uidOf(run, 'm09-ribbon'));
    expect(canMatch(card, identityOf(ctx, uidOf(run, 'm03-pi-a')))).toBe(true);
    expect(card.scoringMonths).toEqual([9]);
    expect(card.ribbonType).toBe('cheongdan');
    const done = playCard(run, uidOf(run, 'm09-ribbon'));
    expect(done.stage!.captured).toContain(uidOf(run, 'm03-pi-a'));
  });
});

describe('jokbo detection', () => {
  const run = newRun('HWATU-JOKBO');
  it('Godori needs February, April and August animals', () => {
    expect(points(run, 'godori', ['m02-animal', 'm04-animal', 'm08-animal'])).toBe(5);
    expect(points(run, 'godori', ['m02-animal', 'm04-animal', 'm06-animal'])).toBe(0);
  });
  it('Hongdan 1/2/3', () => {
    expect(points(run, 'hongdan', ['m01-ribbon', 'm02-ribbon', 'm03-ribbon'])).toBe(3);
    expect(points(run, 'hongdan', ['m01-ribbon', 'm02-ribbon', 'm04-ribbon'])).toBe(0);
  });
  it('Cheongdan 6/9/10', () => {
    expect(points(run, 'cheongdan', ['m06-ribbon', 'm09-ribbon', 'm10-ribbon'])).toBe(3);
    expect(points(run, 'cheongdan', ['m06-ribbon', 'm09-ribbon'])).toBe(0);
  });
  it('Chodan 4/5/7', () => {
    expect(points(run, 'chodan', ['m04-ribbon', 'm05-ribbon', 'm07-ribbon'])).toBe(3);
    expect(points(run, 'chodan', ['m04-ribbon', 'm05-ribbon', 'm12-ribbon'])).toBe(0);
  });
  it('bright tiers: Samgwang / Bisamgwang / Sagwang / Ogwang', () => {
    expect(points(run, 'gwang', ['m01-bright', 'm03-bright', 'm08-bright'])).toBe(3);
    expect(points(run, 'gwang', ['m01-bright', 'm03-bright', 'm12-bright'])).toBe(2);
    expect(points(run, 'gwang', ['m01-bright', 'm03-bright', 'm12-bright'], { rainBrightPenalty: false })).toBe(3);
    expect(points(run, 'gwang', ['m01-bright', 'm03-bright', 'm08-bright', 'm12-bright'])).toBe(4);
    expect(points(run, 'gwang', ['m01-bright', 'm03-bright', 'm08-bright', 'm11-bright', 'm12-bright'])).toBe(15);
    expect(points(run, 'gwang', ['m01-bright', 'm03-bright'])).toBe(0);
  });
  it('Pi: 10 Pi = 1 point, +1 per extra Pi, Double Pi counts 2', () => {
    const tenPi = ['m01-pi-a', 'm01-pi-b', 'm02-pi-a', 'm02-pi-b', 'm03-pi-a', 'm03-pi-b', 'm04-pi-a', 'm04-pi-b', 'm05-pi-a', 'm05-pi-b'];
    expect(points(run, 'pi', tenPi.slice(0, 9))).toBe(0);
    expect(points(run, 'pi', tenPi)).toBe(1);
    expect(points(run, 'pi', [...tenPi, 'm06-pi-a', 'm06-pi-b'])).toBe(3);
    expect(points(run, 'pi', [...tenPi.slice(0, 8), 'm11-doublepi'])).toBe(1);
    expect(points(run, 'pi', [...tenPi.slice(0, 8), 'm11-doublepi', 'm12-doublepi'])).toBe(3);
  });
  it('Animal and Ribbon counts; the December (비) ribbon counts like the other nine', () => {
    expect(points(run, 'animal', ['m02-animal', 'm04-animal', 'm05-animal', 'm06-animal', 'm07-animal'])).toBe(1);
    expect(points(run, 'animal', ['m02-animal', 'm04-animal', 'm05-animal', 'm06-animal', 'm07-animal', 'm08-animal'])).toBe(2);
    expect(points(run, 'ribbon', ['m01-ribbon', 'm02-ribbon', 'm03-ribbon', 'm04-ribbon', 'm12-ribbon'])).toBe(1);
    expect(points(run, 'ribbon', ['m01-ribbon', 'm02-ribbon', 'm03-ribbon', 'm04-ribbon', 'm05-ribbon'])).toBe(1);
    // the old house rule is still available as a switch
    const old = newRun('HWATU-JOKBO', { rainRibbonCountsAsRibbon: false });
    expect(points(old, 'ribbon', ['m01-ribbon', 'm02-ribbon', 'm03-ribbon', 'm04-ribbon', 'm12-ribbon'])).toBe(0);
  });
  it('duplicated set cards form additional disjoint sets', () => {
    expect(maxDisjointSets([1, 2, 4, 1, 2, 4], 3)).toBe(2);
    expect(maxDisjointSets([3, 4, 1, 2, 4], 3)).toBe(2);
    expect(maxDisjointSets([7], 3)).toBe(1);
    expect(maxDisjointSets([1, 1, 2], 3)).toBe(0);
  });
});
