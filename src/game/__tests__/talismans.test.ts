import { describe, expect, it } from 'vitest';
import { setupStage, uidOf } from './helpers';
import { TALISMANS, gainTalisman, newRun, playCard } from '../index';
import { talismanReadiness } from '../rewards/rewards';

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

describe('깨진 거울 (broken mirror)', () => {
  function withCaptured(run: ReturnType<typeof setupStage>, defIds: string[]) {
    const st = run.stage!;
    for (const d of defIds) {
      const u = uidOf(run, d);
      st.stock = st.stock.filter((x) => x !== u);
      st.captured.push(u);
    }
  }

  it('retriggers a lone set Jokbo once at the end of the turn', () => {
    const run = setupStage({ hand: ['m03-ribbon'], field: ['m03-pi-a', 'm07-pi-a'], stock: ['m11-pi-a'] }, (r) => gainTalisman(r, 'broken-mirror'));
    withCaptured(run, ['m01-ribbon', 'm02-ribbon']);
    const st = playCard(run, uidOf(run, 'm03-ribbon')).stage!;
    expect(st.ledger.hongdan.triggers).toBe(2);
    expect(st.ledger.hongdan.retriggers).toBe(1);
  });

  it('ignores count Jokbo (피·띠·열끗)', () => {
    const run = setupStage({ hand: ['m05-pi-a'], field: ['m05-pi-b', 'm07-pi-a'], stock: ['m11-pi-a'] }, (r) => gainTalisman(r, 'broken-mirror'));
    run.stage!.bonusPi = 9;
    const st = playCard(run, uidOf(run, 'm05-pi-a')).stage!;
    expect(st.ledger.pi.points).toBeGreaterThan(0);
    expect(st.ledger.pi.retriggers).toBe(0);
  });
});

describe('engine talismans are offered less before the engine exists', () => {
  it('메아리 북 waits for a retrigger source, 빈 가면 for an Empty Joker', () => {
    const run = newRun('HWATU-READY');
    const drum = TALISMANS.find((t) => t.id === 'echo-drum')!;
    const mask = TALISMANS.find((t) => t.id === 'empty-mask')!;
    expect(talismanReadiness(run, drum)).toBeLessThan(1);
    expect(talismanReadiness(run, mask)).toBeLessThan(1);
    run.deck[3].enhancements.push({ id: 'echo', stacks: 1 });
    run.deck.find((c) => c.defId === 'joker')!.jokerForm = 'empty';
    expect(talismanReadiness(run, drum)).toBe(1);
    expect(talismanReadiness(run, mask)).toBe(1);
  });
});
