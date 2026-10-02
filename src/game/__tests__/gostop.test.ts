import { describe, expect, it } from 'vitest';
import { setupStage, uidOf, profilesFor } from './helpers';
import {
  BALANCE,
  JOKBO_DEFS,
  addCard,
  addMutation,
  chooseTarget,
  createStage,
  deserializeRun,
  evaluateJokbo,
  newRun,
  playBomb,
  playCard,
  shakeableMonths,
  shakeMonthOf,
  serializeRun,
} from '../index';
import type { RunState } from '../types';

function titles(run: RunState): string[] {
  return run.stage!.chains.flatMap((c) => c.steps.map((s) => s.title));
}

describe('뻑', () => {
  it('hand pair + same-month stock card stays on the field as a 뻑 pile (첫뻑 pays 엽전)', () => {
    const run = setupStage({ hand: ['m01-bright', 'm05-pi-a'], field: ['m01-pi-a', 'm07-pi-a'], stock: ['m01-pi-b', 'm11-pi-a'] });
    const coins = run.coins;
    const after = playCard(run, uidOf(run, 'm01-bright'));
    const st = after.stage!;
    const pile = [uidOf(run, 'm01-pi-a'), uidOf(run, 'm01-bright'), uidOf(run, 'm01-pi-b')];
    expect(st.captured).toHaveLength(0);
    for (const u of pile) expect(st.field).toContain(u);
    expect(st.ppeokPiles).toEqual([{ month: 1, uids: pile, turn: 1 }]);
    expect(st.ppeokCount).toBe(1);
    expect(titles(after)).toEqual(expect.arrayContaining(['뻑!', '첫뻑!']));
    expect(after.coins).toBe(coins + BALANCE.specialCoins.firstPpeok!);
    // the stock card was used up by the 뻑 — the next one is still waiting
    expect(st.stock[0]).toBe(uidOf(run, 'm11-pi-a'));
  });

  it('the fourth card eats the pile (자뻑 먹기) and steals 피', () => {
    const run = setupStage({ hand: ['m01-bright', 'm01-ribbon', 'm05-pi-a'], field: ['m01-pi-a', 'm07-pi-a'], stock: ['m01-pi-b', 'm11-pi-a', 'm08-pi-a'] });
    const t1 = playCard(run, uidOf(run, 'm01-bright'));
    const t2 = playCard(t1, uidOf(run, 'm01-ribbon'));
    const st = t2.stage!;
    for (const d of ['m01-bright', 'm01-ribbon', 'm01-pi-a', 'm01-pi-b']) expect(st.captured).toContain(uidOf(run, d));
    expect(st.ppeokPiles).toHaveLength(0);
    expect(st.bonusPi).toBe(BALANCE.specialPi.ppeokEat);
    expect(titles(t2)).toContain('자뻑 먹기!');
    expect(titles(t2)).not.toContain('뭉치 획득!');
  });

  it('two in a row is 연뻑, the third of the stage is 삼뻑 and pays a share of the target', () => {
    const run = setupStage({
      hand: ['m01-bright', 'm02-animal', 'm03-bright', 'm05-pi-a'],
      field: ['m01-pi-a', 'm02-pi-a', 'm03-pi-a', 'm07-pi-a'],
      stock: ['m01-pi-b', 'm02-pi-b', 'm03-pi-b', 'm11-pi-a'],
    });
    const coins = run.coins;
    const t1 = playCard(run, uidOf(run, 'm01-bright'));
    const t2 = playCard(t1, uidOf(run, 'm02-animal'));
    expect(titles(t2)).toContain('연뻑!');
    expect(t2.stage!.score).toBeLessThan(t2.stage!.target);
    const t3 = playCard(t2, uidOf(run, 'm03-bright'));
    const st = t3.stage!;
    expect(st.ppeokCount).toBe(3);
    expect(st.ppeokPiles).toHaveLength(3);
    expect(titles(t3)).toContain('삼뻑!');
    const bonus = st.chains.flatMap((c) => c.steps).find((s) => s.title.startsWith('삼뻑 보너스'))!;
    expect(bonus.value).toBe(Math.round(st.target * BALANCE.triplePpeokTargetFraction));
    // no instant win any more
    expect(st.score).toBeLessThan(st.target);
    expect(st.phase).toBe('play');
    const paid = BALANCE.specialCoins.firstPpeok! + BALANCE.specialCoins.chainPpeok! + BALANCE.specialCoins.triplePpeok!;
    expect(t3.coins).toBe(coins + paid);
  });

  it('a second field card of the month makes it 따닥 instead (첫따닥 pays 엽전)', () => {
    // a second hand card keeps the stage going (an empty hand would end — and maybe clear — it)
    const run = setupStage({ hand: ['m01-bright', 'm05-pi-a'], field: ['m01-pi-a', 'm01-ribbon', 'm07-pi-a'], stock: ['m01-pi-b', 'm11-pi-a'] });
    const coins = run.coins;
    const waiting = playCard(run, uidOf(run, 'm01-bright'));
    const opt = waiting.stage!.pending!.options.find((o) => o.targetUids[0] === uidOf(run, 'm01-pi-a'))!;
    const done = chooseTarget(waiting, opt.id);
    const st = done.stage!;
    expect(st.captured).toHaveLength(4);
    expect(st.ppeokCount).toBe(0);
    expect(titles(done)).toEqual(expect.arrayContaining(['따닥!', '첫따닥!']));
    expect(st.bonusPi).toBe(BALANCE.specialPi.ttadak);
    expect(done.coins).toBe(coins + BALANCE.specialCoins.firstTtadak!);
  });

  it('can be switched off (old rule: hand pair is taken, stock card is placed)', () => {
    const run = setupStage({ hand: ['m01-bright'], field: ['m01-pi-a'], stock: ['m01-pi-b'] }, (r) => {
      r.rules.ppeok = false;
    });
    const st = playCard(run, uidOf(run, 'm01-bright')).stage!;
    expect(st.captured).toEqual(expect.arrayContaining([uidOf(run, 'm01-bright'), uidOf(run, 'm01-pi-a')]));
    expect(st.field).toContain(uidOf(run, 'm01-pi-b'));
    expect(st.ppeokCount).toBe(0);
  });
});

describe('삼뻑 on a boss stage / 고 배', () => {
  it('삼뻑 pays the smaller boss share of the target', () => {
    const run = setupStage({
      hand: ['m01-bright', 'm02-animal', 'm03-bright', 'm05-pi-a'],
      field: ['m01-pi-a', 'm02-pi-a', 'm03-pi-a', 'm07-pi-a'],
      stock: ['m01-pi-b', 'm02-pi-b', 'm03-pi-b', 'm11-pi-a'],
    });
    run.stage!.stageIndex = 5; // June boss (no turn modifiers)
    let r = playCard(run, uidOf(run, 'm01-bright'));
    r = playCard(r, uidOf(run, 'm02-animal'));
    r = playCard(r, uidOf(run, 'm03-bright'));
    const st = r.stage!;
    const bonus = st.chains.flatMap((c) => c.steps).find((s) => s.title.startsWith('삼뻑 보너스'))!;
    expect(bonus.value).toBe(Math.round(st.target * BALANCE.triplePpeokBossTargetFraction));
  });

  it('every 고 adds to the multiplier of later scores', () => {
    const layout = { hand: ['m05-pi-a'], field: ['m05-pi-b'], stock: ['m11-pi-a'] };
    const capture = (r: RunState) =>
      r.stage!.chains.flatMap((c) => c.steps).find((s) => s.kind === 'capture' && s.cardUid === uidOf(r, 'm05-pi-a'))!.value!;
    const plain = playCard(setupStage(layout), uidOf(setupStage(layout), 'm05-pi-a'));
    const goRun = setupStage(layout);
    goRun.stage!.goCount = 2;
    const gone = playCard(goRun, uidOf(goRun, 'm05-pi-a'));
    expect(capture(gone)).toBe(Math.round(capture(plain) * (1 + 2 * BALANCE.goMultAdd)));
  });
});

describe('쪽 / 싹쓸이 / 피 뺏기', () => {
  it('쪽: the stock card takes the card just laid down, and steals a 피', () => {
    const run = setupStage({ hand: ['m05-pi-a'], field: ['m01-pi-a'], stock: ['m05-pi-b'] });
    const after = playCard(run, uidOf(run, 'm05-pi-a'));
    expect(titles(after)).toContain('쪽!');
    expect(after.stage!.bonusPi).toBe(1);
    expect(titles(after)).toContain('피 +1 뺏기');
  });

  it('싹쓸이 steals a 피', () => {
    const run = setupStage({ hand: ['m01-bright'], field: ['m01-pi-a', 'm05-pi-b'], stock: ['m05-pi-a', 'm11-pi-a'] });
    const after = playCard(run, uidOf(run, 'm01-bright'));
    expect(after.stage!.field).toHaveLength(0);
    expect(titles(after)).toContain('싹쓸이!');
    expect(after.stage!.bonusPi).toBe(BALANCE.specialPi.sweep);
  });

  it('stolen 피 counts toward the 피 Jokbo', () => {
    const run = newRun('HWATU-PI');
    const profiles = profilesFor(run, ['m01-pi-a', 'm01-pi-b', 'm02-pi-a', 'm02-pi-b', 'm03-pi-a', 'm03-pi-b', 'm04-pi-a', 'm04-pi-b']);
    expect(evaluateJokbo(JOKBO_DEFS.pi, profiles, { rainBrightPenalty: true }).points).toBe(0);
    expect(evaluateJokbo(JOKBO_DEFS.pi, profiles, { rainBrightPenalty: true, bonusPi: 3 }).points).toBe(2);
  });
});

describe('흔들기 / 폭탄 / 총통', () => {
  it('declaring 흔들기 with one of three same-month hand cards (none on the field): later scores ×shakeMult', () => {
    const layout = { hand: ['m03-bright', 'm03-ribbon', 'm03-pi-a', 'm05-pi-a'], field: ['m05-pi-b', 'm07-pi-a'], stock: ['m11-pi-a', 'm08-pi-a'] };
    const run = setupStage(layout);
    expect(shakeableMonths(run)).toEqual([3]);
    expect(shakeMonthOf(run, uidOf(run, 'm03-pi-a'))).toBe(3);
    expect(shakeMonthOf(run, uidOf(run, 'm05-pi-a'))).toBeUndefined();
    expect(() => playCard(run, uidOf(run, 'm05-pi-a'), undefined, { shake: true })).toThrow();
    const t1 = playCard(run, uidOf(run, 'm03-pi-a'), undefined, { shake: true });
    expect(t1.stage!.shakeCount).toBe(1);
    expect(titles(t1)).toContain('흔들기! 3월');
    // the same 5월 capture next turn is worth exactly shakeMult times as much
    const plain = playCard(setupStage({ ...layout, hand: ['m05-pi-a'] }), uidOf(run, 'm05-pi-a')).stage!;
    const shaken = playCard(t1, uidOf(run, 'm05-pi-a')).stage!;
    const capture = (st: typeof plain) =>
      st.chains.flatMap((c) => c.steps).filter((s) => s.kind === 'capture' && s.cardUid === uidOf(run, 'm05-pi-a'))[0].value!;
    expect(capture(shaken)).toBe(capture(plain) * BALANCE.shakeMult);
  });

  it('흔들기 is never automatic: a plain play of that card does not shake', () => {
    const run = setupStage({ hand: ['m03-bright', 'm03-ribbon', 'm03-pi-a', 'm05-pi-a'], field: ['m07-pi-a'], stock: ['m11-pi-a', 'm12-doublepi'] });
    const st = playCard(run, uidOf(run, 'm03-pi-a')).stage!;
    expect(st.shakeCount).toBe(0);
  });

  it('흔들기 leaves the score already on the board alone (only later scores are multiplied)', () => {
    const run = setupStage({ hand: ['m03-bright', 'm03-ribbon', 'm03-pi-a', 'm05-pi-a'], field: ['m07-pi-a'], stock: ['m11-pi-a', 'm12-doublepi'] });
    run.stage!.score = 500;
    const after = playCard(run, uidOf(run, 'm03-pi-a'), undefined, { shake: true }); // placed, stock card placed too
    const st = after.stage!;
    expect(st.shakeCount).toBe(1);
    expect(st.score).toBe(500);
  });

  it('a declared 흔들기 survives a capture-target choice', () => {
    const run = setupStage({ hand: ['m03-bright', 'm03-ribbon', 'm03-pi-a'], field: ['m04-pi-a', 'm02-pi-a'], stock: ['m11-pi-a'] }, (r) => {
      r.deck.find((c) => c.defId === 'm03-pi-a')!.enhancements.push({ id: 'adjacentMonth', stacks: 1 });
    });
    const waiting = playCard(run, uidOf(run, 'm03-pi-a'), undefined, { shake: true });
    expect(waiting.stage!.phase).toBe('chooseHandTarget');
    const done = chooseTarget(waiting, waiting.stage!.pending!.options[0].id);
    expect(done.stage!.shakeCount).toBe(1);
  });

  it('no extra doubling once the 흔들기 cap is reached', () => {
    const run = setupStage({ hand: ['m03-bright', 'm03-ribbon', 'm03-pi-a'], field: ['m07-pi-a'], stock: ['m11-pi-a'] });
    run.stage!.score = 500;
    run.stage!.shakeCount = BALANCE.shakeMaxStacks;
    const st = playCard(run, uidOf(run, 'm03-pi-a'), undefined, { shake: true }).stage!;
    expect(st.shakeCount).toBe(BALANCE.shakeMaxStacks + 1);
    expect(st.score).toBe(500);
  });

  it('no 흔들기 when the month is already on the field (that is a 폭탄), and 폭탄 counts as a shake', () => {
    const run = setupStage({ hand: ['m03-bright', 'm03-ribbon', 'm03-pi-a', 'm05-pi-a'], field: ['m03-pi-b', 'm07-pi-a'], stock: ['m11-pi-a', 'm08-pi-a', 'm08-pi-b'] });
    expect(shakeableMonths(run)).toEqual([]);
    const after = playBomb(run, 3);
    expect(after.stage!.shakeCount).toBe(1);
    expect(after.stage!.bonusPi).toBe(BALANCE.specialPi.bomb);
    expect(titles(after)).toContain('폭탄!');
  });

  it('흔들기 stacks stop multiplying at the cap', () => {
    const run = setupStage({ hand: ['m05-pi-a'], field: ['m05-pi-b'], stock: ['m11-pi-a'] });
    run.stage!.shakeCount = BALANCE.shakeMaxStacks + 2;
    const st = playCard(run, uidOf(run, 'm05-pi-a')).stage!;
    const entry = st.chains.flatMap((c) => c.steps).find((s) => s.kind === 'capture')!.breakdown!.entries.find((e) => e.source.startsWith('흔들기'))!;
    expect(entry.value).toBe(Math.pow(BALANCE.shakeMult, BALANCE.shakeMaxStacks));
  });

  it('총통 in the opening hand gives its bonus and one 흔들기 stack', () => {
    const run = newRun('HWATU-CHONG');
    run.deck = run.deck.filter((c) => c.defId.startsWith('m01-'));
    while (run.deck.length < 24) addCard(run, 'm01-pi-a', { origin: 'debug' });
    createStage(run, 0);
    const st = run.stage!;
    expect(st.shakeCount).toBe(1);
    expect(st.chains.flatMap((c) => c.steps.map((s) => s.title))).toContain('총통!');
  });

  it('총통 counts scoring months (갈라진 달) the same way 흔들기 and 폭탄 do', () => {
    const run = newRun('HWATU-CHONG2');
    const keep = ['m01-bright', 'm01-ribbon'];
    for (let m = 2; m <= 11; m++) keep.push(`m${m < 10 ? `0${m}` : m}-pi-a`, `m${m < 10 ? `0${m}` : m}-pi-b`);
    keep.push('m12-animal', 'm12-doublepi');
    run.deck = run.deck.filter((c) => keep.includes(c.defId));
    for (const c of run.deck) if (!c.defId.startsWith('m01')) addMutation(run, c, { id: 'splitMoon', month: 1 });
    createStage(run, 0);
    // no printed month appears more than twice, but every card also counts as January
    expect(run.stage!.chains.flatMap((c) => c.steps.map((s) => s.title))).toContain('총통!');
  });
});

describe('save migration', () => {
  it('v1 saves get the new rule switches and stage fields', () => {
    const run = setupStage({ hand: ['m01-bright'], field: ['m01-pi-a'], stock: ['m11-pi-a'] });
    const file = JSON.parse(serializeRun(run));
    file.version = 1;
    delete file.run.rules.ppeok;
    delete file.run.rules.shake;
    delete file.run.rules.piSteal;
    for (const k of ['ppeokPiles', 'ppeokCount', 'bonusPi', 'shakeCount']) delete file.run.stage[k];
    const loaded = deserializeRun(JSON.stringify(file))!;
    expect(loaded.rules.ppeok).toBe(true);
    expect(loaded.stage!.ppeokPiles).toEqual([]);
    expect(loaded.stage!.bonusPi).toBe(0);
    expect(loaded.stage!.shakeCount).toBe(0);
    // and the loaded run still plays
    expect(playCard(loaded, uidOf(run, 'm01-bright')).stage!.captured.length).toBeGreaterThan(0);
  });
});
