import { describe, expect, it } from 'vitest';
import { setupStage, uidOf } from './helpers';
import { gainTalisman, playCard } from '../index';

describe('짐승 발자국 (beast tracks)', () => {
  const layout = {
    hand: ['m06-animal', 'm07-animal', 'm11-pi-b', 'm05-pi-a'],
    field: ['m06-pi-a', 'm07-pi-a', 'm03-pi-a'],
    // stock cards land on the field without matching anything (no 뻑, no captures)
    stock: ['m11-pi-a', 'm01-pi-a', 'm08-pi-a', 'm02-pi-a'],
  };

  it('a pair counts once and the combo grows across consecutive animal captures', () => {
    const run = setupStage(layout, (r) => gainTalisman(r, 'beast-tracks'));
    const t1 = playCard(run, uidOf(run, 'm06-animal'));
    // the 6월 피 taken together with the animal must not reset the combo
    expect(t1.stage!.counters['animalCombo']).toBe(1);
    const t2 = playCard(t1, uidOf(run, 'm07-animal'));
    expect(t2.stage!.counters['animalCombo']).toBe(2);
  });

  it('a capture without an animal resets the combo', () => {
    const run = setupStage(layout, (r) => gainTalisman(r, 'beast-tracks'));
    const t1 = playCard(run, uidOf(run, 'm06-animal'));
    const t2 = playCard(t1, uidOf(run, 'm07-animal'));
    // 11월 피 takes the 11월 피 the stock laid down on turn 1
    const t3 = playCard(t2, uidOf(run, 'm11-pi-b'));
    expect(t3.stage!.captured).toContain(uidOf(run, 'm11-pi-a'));
    expect(t3.stage!.counters['animalCombo']).toBe(0);
  });
});
