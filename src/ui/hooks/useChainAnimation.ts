import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChainStep, RunState } from '../../game';
import type { AnimSpeed } from './useGame';

export interface AnimStep {
  chainId: number;
  chainTitle: string;
  step: ChainStep;
}

const BASE_DELAY: Record<AnimSpeed, number> = { normal: 430, fast: 140, instant: 0 };
const SCORE_KINDS = new Set(['capture', 'score', 'special']);

export interface ChainAnimation {
  current?: AnimStep;
  shown: AnimStep[];
  busy: boolean;
  pendingScore: number;
  skip: () => void;
}

/** Plays newly appended chain steps one by one. Steps present at mount (loaded saves) are not replayed. */
export function useChainAnimation(run: RunState | null, speed: AnimSpeed): ChainAnimation {
  const stage = run?.stage;
  const key = run ? `${run.seed}:${run.createdAt}:${stage?.stageIndex ?? -1}` : '';
  const seen = useRef<Map<number, number>>(new Map());
  const seenKey = useRef<string>('');
  const [queue, setQueue] = useState<AnimStep[]>([]);
  const [shown, setShown] = useState<AnimStep[]>([]);
  const [current, setCurrent] = useState<AnimStep | undefined>();

  useEffect(() => {
    if (!stage) return;
    if (seenKey.current !== key) {
      // new stage or loaded game: start fresh, but animate the stage-start chain
      seenKey.current = key;
      seen.current = new Map();
      const fresh = stage.chains.length <= 3;
      if (!fresh) for (const c of stage.chains) seen.current.set(c.id, c.steps.length);
      setShown([]);
      setQueue([]);
      setCurrent(undefined);
    }
    const added: AnimStep[] = [];
    for (const c of stage.chains) {
      const n = seen.current.get(c.id) ?? 0;
      if (c.steps.length > n) {
        for (const s of c.steps.slice(n)) added.push({ chainId: c.id, chainTitle: c.title, step: s });
        seen.current.set(c.id, c.steps.length);
      }
    }
    if (added.length) setQueue((q) => [...q, ...added]);
  }, [stage, key]);

  useEffect(() => {
    if (!queue.length) {
      const t = setTimeout(() => setCurrent(undefined), speed === 'instant' ? 0 : 900);
      return () => clearTimeout(t);
    }
    if (speed === 'instant') {
      setShown((s) => [...s, ...queue].slice(-80));
      setCurrent(queue[queue.length - 1]);
      setQueue([]);
      return;
    }
    const next = queue[0];
    const accel = Math.max(0.3, 1 - queue.length / 30);
    const important = next.step.kind === 'jokbo' || next.step.kind === 'retrigger' || next.step.kind === 'overflow';
    const delay = BASE_DELAY[speed] * accel * (important ? 1.4 : next.step.kind === 'capture' ? 0.6 : 1);
    setCurrent(next);
    setShown((s) => [...s, next].slice(-80));
    const t = setTimeout(() => setQueue((q) => q.slice(1)), delay);
    return () => clearTimeout(t);
  }, [queue, speed]);

  const skip = useCallback(() => {
    setQueue((q) => {
      // the head of the queue is already on screen (and in `shown`) — don't add it twice
      if (q.length)
        setShown((s) => {
          const has = new Set(s.map((a) => `${a.chainId}:${a.step.id}`));
          return [...s, ...q.filter((a) => !has.has(`${a.chainId}:${a.step.id}`))].slice(-80);
        });
      return [];
    });
  }, []);

  const pendingScore = queue.slice(speed === 'instant' ? 0 : 1).reduce((s, a) => s + (SCORE_KINDS.has(a.step.kind) ? (a.step.value ?? 0) : 0), 0);
  return { current, shown, busy: queue.length > 0, pendingScore, skip };
}
