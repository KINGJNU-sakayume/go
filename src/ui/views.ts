import { Rng, makeContext, viewOf, type CardView, type RunState } from '../game';

/** Returns a memo-friendly card view lookup for one immutable run snapshot. */
export function makeViewFn(run: RunState): (uid: string) => CardView {
  const ctx = makeContext(run, run.stage, new Rng(run.stage?.rng ?? [1, 2, 3, 4]));
  const cache = new Map<string, CardView>();
  return (uid: string) => {
    let v = cache.get(uid);
    if (!v) {
      v = viewOf(ctx, uid);
      cache.set(uid, v);
    }
    return v;
  };
}

/** Views for cards outside a stage (deck viewer, shop) — no temporary stage effects. */
export function makeDeckViewFn(run: RunState): (uid: string) => CardView {
  const ctx = makeContext(run, undefined, new Rng([1, 2, 3, 4]));
  const cache = new Map<string, CardView>();
  return (uid: string) => {
    let v = cache.get(uid);
    if (!v) {
      v = viewOf(ctx, uid);
      cache.set(uid, v);
    }
    return v;
  };
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}
