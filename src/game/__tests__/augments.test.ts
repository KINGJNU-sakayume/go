import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  buyOffer,
  chooseEventOption,
  createEventState,
  generateShop,
  identityOf,
  makeContext,
  monthsAround,
  newRun,
  opChoices,
  opHidesOutcome,
  opIsRanged,
  opNeedsChoice,
  pushOp,
  resolveOperation,
  Rng,
  shiftCandidates,
  splitCandidates,
} from '../index';
import type { OperationKind, PendingOperation, RunState } from '../types';

function op(run: RunState, kind: OperationKind, extra: Partial<PendingOperation> = {}): PendingOperation {
  return pushOp(run, { kind, title: kind, description: '', source: 'debug', count: 1, cancellable: false, then: [], ...extra });
}
function idOf(run: RunState, uid: string) {
  return identityOf(makeContext(run, undefined, new Rng([1, 2, 3, 4])), uid);
}
function uidOf(run: RunState, defId: string): string {
  return run.deck.find((c) => c.defId === defId)!.uid;
}

describe('month ranges', () => {
  it('wraps around the year and excludes what it should', () => {
    expect(monthsAround(1, 1, 2, [1])).toEqual([2, 3, 11, 12]);
    expect(monthsAround(6, 2, 3, [6])).toEqual([3, 4, 8, 9]);
    expect(monthsAround(12, 1, 1, [11, 1])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12].filter((m) => ![11, 1].includes(m)));
  });
});

describe('rolled identity operations (default)', () => {
  it('달 바꾸기 rolls inside the published range, needs no choice and hides its result', () => {
    for (let i = 0; i < 12; i++) {
      const run = newRun(`HWATU-RANGE${i}`);
      const o = op(run, 'monthShift');
      expect(opIsRanged(o)).toBe(true);
      expect(opNeedsChoice(o)).toBe(false);
      expect(opHidesOutcome(o)).toBe(true);
      const uid = uidOf(run, 'm06-pi-a');
      const range = shiftCandidates(run, uid);
      expect(range).toEqual([4, 5, 7, 8]);
      const after = resolveOperation(run, o.id, { cardUids: [uid] });
      expect(range).toContain(idOf(after, uid).printedMonth);
      // deterministic: the same choice on the same run rolls the same month (no re-rolling by reloading)
      expect(idOf(resolveOperation(run, o.id, { cardUids: [uid] }), uid).printedMonth).toBe(idOf(after, uid).printedMonth);
    }
  });

  it('갈라진 달 adds one month from its range', () => {
    const run = newRun('HWATU-SPLIT');
    const o = op(run, 'splitMoon');
    const uid = uidOf(run, 'm09-ribbon');
    const range = splitCandidates(run, uid);
    const after = resolveOperation(run, o.id, { cardUids: [uid] });
    const months = idOf(after, uid).scoringMonths;
    expect(months).toContain(9);
    expect(months.filter((m) => m !== 9).every((m) => range.includes(m))).toBe(true);
  });

  it('띠 염색 lets the player pick the colour; the slot is rolled inside that set', () => {
    const run = newRun('HWATU-DYE');
    const o = op(run, 'ribbonDye');
    const uid = uidOf(run, 'm01-ribbon');
    const choices = opChoices(run, o, uid);
    expect(choices).toHaveLength(3);
    const blue = choices.find((c) => c.id.startsWith('ribbonDye~:cheongdan'))!;
    const id = idOf(resolveOperation(run, o.id, { cardUids: [uid], choiceId: blue.id }), uid);
    expect(id.ribbonType).toBe('cheongdan');
    expect([6, 9, 10]).toContain(id.printedMonth);
  });

  it('종류 접목 adds a category the card does not have yet', () => {
    const run = newRun('HWATU-GRAFT');
    const o = op(run, 'typeGraft');
    const uid = uidOf(run, 'm03-bright');
    const id = idOf(resolveOperation(run, o.id, { cardUids: [uid] }), uid);
    expect(id.categories.filter((c) => c !== 'bright').length).toBe(1);
  });

  it('a rolled 족보 수련 needs no choice and raises exactly one Jokbo by one level', () => {
    const run = newRun('HWATU-JOKBOROLL');
    const o = op(run, 'upgradeJokbo', { count: 0, levels: 1 });
    expect(opNeedsChoice(o)).toBe(false);
    const after = resolveOperation(run, o.id, {});
    const raised = Object.values(after.jokbo).filter((p) => p.level === 2);
    expect(raised).toHaveLength(1);
  });

  it('draft offers (변이 / Lv.4 강화) name a range, never a single month', () => {
    const run = newRun('HWATU-DRAFT');
    const uid = uidOf(run, 'm06-ribbon');
    run.deck.find((c) => c.uid === uid)!.level = 6;
    for (let i = 0; i < 20; i++) {
      const o = op(run, 'mutateCard');
      for (const c of opChoices(run, o, uid)) {
        if (/^(monthShift|splitMoon|tripleMoon|ribbonDye)/.test(c.id)) expect(c.id).toContain('~');
      }
      const e = op(run, 'levelEnhancement', { cardUid: uid });
      for (const c of opChoices(run, e, uid)) if (c.id.startsWith('dualMonth')) expect(c.id).toContain('~');
    }
  });
});

describe('exact (premium) identity operations', () => {
  it('the exact 달 바꾸기 takes the month the player picks', () => {
    const run = newRun('HWATU-EXACT');
    const o = op(run, 'monthShift', { exact: true });
    expect(opIsRanged(o)).toBe(false);
    expect(opHidesOutcome(o)).toBe(false);
    const uid = uidOf(run, 'm06-pi-a');
    expect(opChoices(run, o, uid)).toHaveLength(11);
    const after = resolveOperation(run, o.id, { cardUids: [uid], choiceId: 'm12' });
    expect(idOf(after, uid).printedMonth).toBe(12);
  });

  it('the shop sells the rolled dye cheap and the exact one at a premium', () => {
    const run = newRun('HWATU-SHOP');
    run.phase = 'shop';
    run.coins = 100;
    run.shop = generateShop(run, 1);
    run.shop.offers = [
      { id: 'a', service: 'monthDye', title: '달 염색', description: '', price: BALANCE.servicePrice.monthDye, rarity: 'uncommon', sold: false, repeatable: false },
      { id: 'b', service: 'monthDyeExact', title: '화공의 붓', description: '', price: BALANCE.servicePrice.monthDyeExact, rarity: 'rare', sold: false, repeatable: false },
    ];
    expect(BALANCE.servicePrice.monthDyeExact).toBeGreaterThanOrEqual(2 * BALANCE.servicePrice.monthDye);
    const cheap = buyOffer(run, 'a').run;
    expect(cheap.ops[0].kind).toBe('monthShift');
    expect(cheap.ops[0].exact).toBeUndefined();
    const dear = buyOffer(run, 'b').run;
    expect(dear.ops[0].exact).toBe(true);
  });

  it('events: the free brush rolls, paying coins picks', () => {
    const run = newRun('HWATU-PAINTER');
    run.coins = 20;
    run.phase = 'event';
    run.event = createEventState(run, 'painter');
    const free = chooseEventOption(run, 'month');
    expect(free.ops[0].exact).toBeUndefined();
    expect(free.coins).toBe(20);
    const paid = chooseEventOption(run, 'monthExact');
    expect(paid.ops[0].exact).toBe(true);
    expect(paid.coins).toBe(10);
  });
});

describe('rolled outcomes are not previewed', () => {
  it('도깨비 내기, 고대의 패 and 잃어버린 한 장 hide their result', () => {
    const run = newRun('HWATU-HIDE');
    expect(opHidesOutcome(op(run, 'gambleCard', { chance: 0.55 }))).toBe(true);
    expect(opHidesOutcome(op(run, 'ancientCard'))).toBe(true);
    expect(opHidesOutcome(op(run, 'discoverMonth', { count: 0 }))).toBe(true);
    expect(opHidesOutcome(op(run, 'upgradeCard', { levels: 1 }))).toBe(false);
  });
});
