import { useState, type ReactElement } from 'react';
import { JOKBO_DEFS, type ChainTone, type RunState, type ScoreBreakdown } from '../../game';
import type { AnimStep } from '../hooks/useChainAnimation';
import { Seal } from '../components/Seal';
import { fmt } from '../views';

export const TONE: Record<ChainTone, string> = {
  red: '#f87171',
  blue: '#7aa7ff',
  green: '#6ee7a0',
  gold: '#f2c66b',
  purple: '#c9a0ff',
  gray: '#e7dccb',
  pink: '#ff9fb4',
  cyan: '#5fe0ef',
};

function Breakdown({ b }: { b: ScoreBreakdown }): ReactElement {
  return (
    <div className="mt-1 space-y-px text-left text-xs text-stone-300">
      {b.entries.map((e, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span>{e.source}</span>
          <span className="font-mono">
            {e.kind === 'base' || e.kind === 'power' || e.kind === 'flat' ? `+${fmt(e.value)}` : e.kind.endsWith('Add') ? `+${e.value}` : `×${e.value}`}
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-white/10 pt-px font-bold text-amber-200">
        <span>
          끗 {fmt(b.base + b.power + b.flat)} × 배 {Math.round(b.jokboMult * b.globalMult * 100) / 100}
        </span>
        <span>{fmt(b.total)}</span>
      </div>
    </div>
  );
}

const BIG = new Set(['jokbo', 'retrigger', 'overflow', 'special', 'mult']);

/**
 * In-world callouts over the table: 족보 and special plays are brushed onto the felt with a seal
 * stamp; small events (captures, reveals) get a quiet caption. Click the table to skip.
 */
export function ChainCallout({ current, shown, busy }: { current?: AnimStep; shown: AnimStep[]; busy: boolean }): ReactElement | null {
  if (!current) return null;
  const s = current.step;
  const big = BIG.has(s.kind) || (s.kind === 'effect' && !!s.value) || (s.kind === 'score' && (s.value ?? 0) > 0);
  const trail = shown.filter((a) => a.chainId === current.chainId && BIG.has(a.step.kind)).slice(-5, -1);
  const color = TONE[s.tone ?? 'gray'];
  const glyph = s.jokboId ? JOKBO_DEFS[s.jokboId].glyph : s.kind === 'retrigger' ? '再' : s.kind === 'overflow' ? '熱' : s.kind === 'mult' ? '倍' : '妙';
  const count = s.chainCount ?? 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-center">
      {/* quiet caption for small steps */}
      {!big && (
        <div key={`c-${current.chainId}-${s.id}`} className="float-up mt-2 rounded bg-black/45 px-3 py-1 text-sm text-stone-100">
          <span style={{ color }}>{s.title}</span>
          {s.value ? <b className="ml-1.5 text-amber-200">+{fmt(s.value)}</b> : null}
        </div>
      )}
      {big && (
        <div key={`b-${current.chainId}-${s.id}`} className="mt-3 flex items-center gap-3">
          <span className="stamp-in">
            <Seal char={glyph} size={52} tone={s.kind === 'overflow' ? 'ink' : 'red'} />
          </span>
          <div className="text-left">
            <div className="brush-in ink-shadow text-4xl font-black md:text-5xl" style={{ color, fontFamily: 'var(--font-serif)' }}>
              {s.title}
            </div>
            {s.value ? <div className="ink-shadow text-2xl font-black text-amber-300">+{fmt(s.value)}</div> : null}
            {s.detail && <div className="ink-shadow max-w-md text-sm text-stone-100">{s.detail}</div>}
          </div>
          {count >= 2 && (
            <span className="stamp-in ml-1 flex flex-col items-center">
              <Seal char={String(count)} size={34} tone="ink" />
              <span className="ink-shadow mt-0.5 text-xs font-bold text-stone-200">연쇄</span>
            </span>
          )}
        </div>
      )}
      {trail.length > 0 && (
        <div className="ink-shadow mt-1 flex max-w-xl flex-wrap justify-center gap-x-1.5 text-xs">
          {trail.map((a) => (
            <span key={a.step.id} style={{ color: TONE[a.step.tone ?? 'gray'] }}>
              {a.step.title} →
            </span>
          ))}
          <span style={{ color }}>{s.title}</span>
        </div>
      )}
      {busy && <div className="ink-shadow mt-1 text-xs text-stone-300/80">판을 누르면 건너뜀</div>}
    </div>
  );
}

/** Compact history of recent chains with expandable 끗 × 배 breakdowns. */
export function ChainHistory({ run }: { run: RunState }): ReactElement {
  const [open, setOpen] = useState<number | null>(null);
  const chains = [...(run.stage?.chains ?? [])].filter((c) => !c.open).reverse().slice(0, 8);
  return (
    <details className="panel p-2" open>
      <summary className="section-title cursor-pointer list-none">연쇄 기록</summary>
      <div className="mt-1 max-h-72 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
        {chains.length === 0 && <div className="text-xs text-stone-500">아직 없음</div>}
        {chains.map((c) => {
          const key = c.steps.filter((s) => ['jokbo', 'retrigger', 'effect', 'special', 'mult', 'overflow'].includes(s.kind));
          return (
            <div key={c.id} className="rounded bg-black/25 p-1.5 text-xs">
              <button type="button" className="flex w-full justify-between gap-2 text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <span className="truncate text-stone-300">
                  {c.title}
                  {c.triggerCount >= 2 && <span className="ml-1 text-amber-300">연쇄 {c.triggerCount}</span>}
                  {c.overflow && <span className="ml-1 text-red-400">과열</span>}
                </span>
                <span className="font-bold text-amber-300">+{fmt(c.totalScore)}</span>
              </button>
              {key.length > 0 && (
                <div className="leading-snug">
                  {key.map((s) => (
                    <span key={s.id} style={{ color: TONE[s.tone ?? 'gray'] }}>
                      {s.title} ›{' '}
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
                      {s.breakdown && (s.kind === 'score' || s.kind === 'capture') && <Breakdown b={s.breakdown} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
