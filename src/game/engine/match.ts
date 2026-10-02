import type { CaptureOption, Month } from '../types';
import { ALL_MONTHS } from '../types';
import type { CardIdentity } from '../cards/identity';
import { identityOf, type GameContext } from '../effects/context';

/**
 * Two cards match when one card's matching months reach the other's identity months.
 * Matching months include Dual Month / Adjacent / Wild; identity months include Split/Triple Moon.
 */
export function canMatch(a: CardIdentity, b: CardIdentity): boolean {
  if (a.matchMonths.some((m) => b.scoringMonths.includes(m))) return true;
  if (b.matchMonths.some((m) => a.scoringMonths.includes(m))) return true;
  // a wild card meets another wild card (e.g. two jokers) only if one has an identity month
  return false;
}

/** February frost: a frozen field card cannot be paired until it thaws. */
export function isFrozen(ctx: GameContext, uid: string): boolean {
  const until = ctx.stage?.temp[uid]?.frozenUntil;
  return until !== undefined && until >= (ctx.stage?.turn ?? 0);
}

/** Stable identity used to collapse equivalent targets (two plain Pi of one month → no choice needed). */
function targetSignature(ctx: GameContext, id: CardIdentity): string {
  const t = ctx.stage?.temp[id.card.uid];
  const covered = ctx.stage?.covered.includes(id.card.uid);
  return JSON.stringify([
    id.def.id,
    id.level,
    id.card.enhancements,
    id.card.mutations,
    id.card.bonusPower,
    id.card.jokerForm,
    t ?? null,
    covered,
  ]);
}

/**
 * Capture options for playing / revealing `playedUid` onto the field.
 * - no match → place on field
 * - a month with ≥3 matching field cards → stack capture (takes all of them)
 * - otherwise one option per matching field card (player chooses)
 */
export function getCaptureOptions(ctx: GameContext, playedUid: string, fieldUids: string[]): CaptureOption[] {
  const played = identityOf(ctx, playedUid);
  const field = fieldUids.map((u) => identityOf(ctx, u));
  const matches = field.filter((f) => canMatch(played, f) && !isFrozen(ctx, f.card.uid));
  if (!matches.length) return [{ id: 'place', kind: 'place', targetUids: [] }];

  const options: CaptureOption[] = [];
  const inStack = new Set<string>();
  const months: readonly Month[] = played.wild ? ALL_MONTHS : played.matchMonths;
  const seenStacks = new Set<string>();
  for (const m of months) {
    const group = matches.filter((f) => f.scoringMonths.includes(m));
    if (group.length >= 3) {
      const uids = group.map((g) => g.card.uid).sort();
      const key = uids.join(',');
      if (seenStacks.has(key)) continue;
      seenStacks.add(key);
      for (const u of uids) inStack.add(u);
      options.push({ id: `stack-${m}`, kind: 'stack', targetUids: group.map((g) => g.card.uid), month: m });
    }
  }
  const seenSig = new Set<string>();
  for (const f of matches) {
    if (inStack.has(f.card.uid)) continue;
    const sig = targetSignature(ctx, f);
    if (seenSig.has(sig)) continue;
    seenSig.add(sig);
    options.push({ id: `single-${f.card.uid}`, kind: 'single', targetUids: [f.card.uid], month: f.scoringMonths[0] });
  }
  return options;
}

/** Field cards that `uid` could match (for hover highlighting). Covered cards are never revealed this way. */
export function matchableFieldCards(ctx: GameContext, uid: string): string[] {
  const stage = ctx.stage;
  if (!stage) return [];
  const played = identityOf(ctx, uid);
  return stage.field.filter((f) => !stage.covered.includes(f) && !isFrozen(ctx, f) && canMatch(played, identityOf(ctx, f)));
}

export interface BombOption {
  month: Month;
  handUids: string[];
  fieldUids: string[];
}

/** 폭탄: three or more hand cards of one month + at least one field card of that month. */
export function getBombOptions(ctx: GameContext): BombOption[] {
  const stage = ctx.stage;
  if (!stage) return [];
  const out: BombOption[] = [];
  for (const m of ALL_MONTHS) {
    const hand = stage.hand.filter((u) => {
      const id = identityOf(ctx, u);
      return !id.joker && id.scoringMonths.includes(m);
    });
    if (hand.length < 3) continue;
    const field = stage.field.filter((u) => !isFrozen(ctx, u) && identityOf(ctx, u).scoringMonths.includes(m));
    if (!field.length) continue;
    out.push({ month: m, handUids: hand, fieldUids: field });
  }
  return out;
}
