import { useState, type ReactElement } from 'react';
import type { ChainTone, RunState, ScoreBreakdown } from '../../game';
import type { AnimStep } from '../hooks/useChainAnimation';
import { fmt } from '../views';

export const TONE: Record<ChainTone, string> = {
  red: '#f87171',
  blue: '#60a5fa',
  green: '#4ade80',
  gold: '#fbbf24',
  purple: '#c084fc',
  gray: '#d6d3d1',
  pink: '#f472b6',
  cyan: '#22d3ee',
};

function Breakdown({ b }: { b: ScoreBreakdown }): ReactElement {
  return (
    <div className="mt-1 space-y-px text-left text-[10px] text-stone-300">
      {b.entries.map((e, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span>{e.source}</span>
          <span className="font-mono">
            {e.kind === 'base' || e.kind === 'power' || e.kind === 'flat'
              ? `+${fmt(e.value)}`
              : e.kind.endsWith('Add')
                ? `+${e.value}`
                : `×${e.value}`}
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-white/10 pt-px font-bold text-amber-200">
        <span>
          ({fmt(b.base)}+{fmt(b.power)}+{fmt(b.flat)}) ×{b.jokboMult} ×{b.globalMult}
        </span>
        <span>{fmt(b.total)}</span>
      </div>
    </div>
  );
}

/** The big, sequential trigger display shown over the field. */
export function ChainSpotlight({ current, shown, busy, onSkip }: { current?: AnimStep; shown: AnimStep[]; busy: boolean; onSkip: () => void }): ReactElement | null {
  if (!current) return null;
  const sameChain = shown.filter((s) => s.chainId === current.chainId).slice(-7);
  const s = current.step;
  const big = s.kind === 'jokbo' || s.kind === 'retrigger' || s.kind === 'overflow' || (s.kind === 'score' && (s.value ?? 0) > 0) || s.kind === 'special' || s.kind === 'effect' || s.kind === 'mult';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex flex-col items-center">
      <div className="pointer-events-auto rounded-xl border border-amber-200/20 bg-black/75 px-4 py-2 text-center shadow-2xl backdrop-blur-sm" onClick={onSkip}>
        <div className="text-[10px] tracking-widest text-stone-400">
          {current.chainTitle}
          {(s.chainCount ?? 0) >= 2 && <span className="ml-2 font-black text-fuchsia-300">연쇄 ×{s.chainCount}</span>}
        </div>
        <div key={`${current.chainId}-${s.id}`} className="pop-in">
          <div className={`${big ? 'text-2xl md:text-3xl' : 'text-lg'} font-black`} style={{ color: TONE[s.tone ?? 'gray'], fontFamily: 'var(--font-serif)' }}>
            {s.title}
          </div>
          {s.value !== undefined && s.value !== 0 && <div className="text-xl font-black text-amber-300">+{fmt(s.value)}</div>}
          {s.detail && <div className="text-xs text-stone-300">{s.detail}</div>}
          {s.source && s.kind !== 'effect' && <div className="text-[10px] text-stone-500">{s.source}</div>}
        </div>
        <div className="mt-1 flex max-w-md flex-wrap justify-center gap-x-1 text-[10px] text-stone-400">
          {sameChain.slice(0, -1).map((a) => (
            <span key={a.step.id} style={{ color: TONE[a.step.tone ?? 'gray'] }}>
              {a.step.title}
              {a.step.value ? ` +${fmt(a.step.value)}` : ''} ↓
            </span>
          ))}
        </div>
        {busy && <div className="mt-1 text-[9px] text-stone-500">클릭하면 건너뛰기</div>}
      </div>
    </div>
  );
}

/** Compact history of recent chains with expandable score breakdowns. */
export function ChainHistory({ run }: { run: RunState }): ReactElement {
  const [open, setOpen] = useState<number | null>(null);
  const chains = [...(run.stage?.chains ?? [])].filter((c) => !c.open).reverse().slice(0, 8);
  return (
    <div className="panel p-2">
      <div className="mb-1 text-xs font-black tracking-widest text-amber-200">연쇄 기록</div>
      <div className="max-h-64 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
        {chains.length === 0 && <div className="text-[11px] text-stone-500">아직 없음</div>}
        {chains.map((c) => {
          const key = c.steps.filter((s) => ['jokbo', 'retrigger', 'effect', 'special', 'mult', 'overflow'].includes(s.kind));
          return (
            <div key={c.id} className="rounded bg-black/25 p-1 text-[11px]">
              <button type="button" className="flex w-full justify-between text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <span className="truncate text-stone-300">
                  {c.title}
                  {c.triggerCount >= 2 && <span className="ml-1 text-fuchsia-300">×{c.triggerCount}</span>}
                  {c.overflow && <span className="ml-1 text-red-400">과열</span>}
                </span>
                <span className="font-bold text-amber-300">+{fmt(c.totalScore)}</span>
              </button>
              {key.length > 0 && (
                <div className="text-[10px] leading-tight">
                  {key.map((s) => (
                    <span key={s.id} style={{ color: TONE[s.tone ?? 'gray'] }}>
                      {s.title} →{' '}
                    </span>
                  ))}
                </div>
              )}
              {open === c.id && (
                <div className="mt-1 space-y-1 border-t border-white/10 pt-1">
                  {c.steps.map((s) => (
                    <div key={s.id} style={{ paddingLeft: Math.min(s.depth, 6) * 6 }}>
                      <span style={{ color: TONE[s.tone ?? 'gray'] }}>{s.title}</span>
                      {s.value ? <span className="text-amber-200"> +{fmt(s.value)}</span> : null}
                      {s.breakdown && s.kind === 'score' && <Breakdown b={s.breakdown} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
