import '../index';
import type { CardInstance, RunState } from '../types';
import { newRun } from '../engine/run';
import { addCard } from '../engine/operations';
import { makeContext, profileOf } from '../effects/context';
import { Rng } from '../rng/rng';

/** Find (or create) a card instance for a definition id that is not already used. */
export function cardFor(run: RunState, defId: string, used: Set<string>): CardInstance {
  let c = run.deck.find((x) => x.defId === defId && !used.has(x.uid));
  if (!c) c = addCard(run, defId, { origin: 'debug' });
  used.add(c.uid);
  return c;
}

/**
 * Build a run whose current stage has exactly the given hand / field / stock (by definition id).
 * Unlisted cards go to the bottom of the stock in deck order.
 */
export function setupStage(
  layout: { hand: string[]; field: string[]; stock?: string[] },
  mutate?: (run: RunState) => void,
  seed = 'HWATU-TEST01',
): RunState {
  const run = newRun(seed);
  mutate?.(run);
  const stage = run.stage!;
  const used = new Set<string>();
  const hand = layout.hand.map((d) => cardFor(run, d, used).uid);
  const field = layout.field.map((d) => cardFor(run, d, used).uid);
  const stock = (layout.stock ?? []).map((d) => cardFor(run, d, used).uid);
  const rest = run.deck.filter((c) => !used.has(c.uid) && c.defId !== 'joker').map((c) => c.uid);
  stage.hand = hand;
  stage.field = field;
  stage.stock = [...stock, ...rest];
  stage.captured = [];
  stage.score = 0;
  stage.chains = [];
  stage.phase = 'play';
  stage.turn = 1;
  return run;
}

export function uidOf(run: RunState, defId: string, nth = 0): string {
  return run.deck.filter((c) => c.defId === defId)[nth].uid;
}

export function profilesFor(run: RunState, defIds: string[]) {
  const ctx = makeContext(run, run.stage, new Rng([1, 2, 3, 4]));
  const used = new Set<string>();
  return defIds.map((d) => profileOf(ctx, cardFor(run, d, used).uid));
}
