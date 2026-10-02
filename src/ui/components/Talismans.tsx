import { useState, type ReactElement } from 'react';
import { getTalismanDef, type ChainStep, type RunState } from '../../game';
import type { AnimStep } from '../hooks/useChainAnimation';
import { RARITY_KO } from './Modal';

const RARITY_THREAD: Record<string, string> = {
  common: '#a8a29e',
  uncommon: '#3f9b6e',
  rare: '#3b6fd8',
  mythic: '#b45cf0',
};

function fmtEntry(kind: string, value: number): string {
  if (kind === 'flat' || kind === 'power' || kind === 'base') return `+${Math.round(value)}끗`;
  if (kind.endsWith('Add')) return `배 +${value}`;
  return `배 ×${value}`;
}

/** Which talismans are reacting to this animation step, and what each one contributed. */
export function talismanReactions(step: ChainStep | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!step) return out;
  if (step.sourceKind === 'talisman' && step.sourceId) out.set(step.sourceId, step.value ? `+${step.value.toLocaleString('ko-KR')}` : step.title);
  for (const e of step.breakdown?.entries ?? []) {
    if (e.sourceKind !== 'talisman' || !e.sourceId) continue;
    const text = fmtEntry(e.kind, e.value);
    out.set(e.sourceId, out.has(e.sourceId) ? `${out.get(e.sourceId)} ${text}` : text);
  }
  return out;
}

function Slip({ id, counters, active, pulseKey, size }: { id: string; counters: Record<string, number>; active?: string; pulseKey?: string; size: 'sm' | 'md' }): ReactElement | null {
  const [hover, setHover] = useState(false);
  const def = getTalismanDef(id);
  if (!def) return null;
  const w = size === 'sm' ? 38 : 46;
  const h = size === 'sm' ? 54 : 66;
  const counterText = Object.entries(counters)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k === 'removed' ? '제거한 카드' : k} ${v}`)
    .join(' · ');
  return (
    <div className="relative flex flex-col items-center" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div key={pulseKey} className={active ? 'talisman-jolt' : ''} style={{ transformOrigin: '50% 0%' }}>
        {/* the thread the slip hangs from shows its rarity */}
        <div className="mx-auto h-2 w-0.5" style={{ background: RARITY_THREAD[def.rarity] }} />
        <div
          className="relative flex flex-col items-center justify-center rounded-[3px]"
          style={{
            width: w,
            height: h,
            background: 'linear-gradient(175deg, #f4d77e, #dcb24f 70%, #c99a3a)',
            boxShadow: active
              ? '0 0 0 2px #fff3c4, 0 0 18px rgba(255,214,120,0.85)'
              : '0 2px 4px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(120,70,10,0.35)',
          }}
        >
          <span className="absolute inset-x-1 top-1 h-px bg-[#b8261c]/60" />
          <span className="absolute inset-x-1 bottom-1 h-px bg-[#b8261c]/60" />
          <span className="font-black leading-none text-[#a3170f]" style={{ fontFamily: 'var(--font-serif)', fontSize: size === 'sm' ? 20 : 26 }}>
            {def.glyph}
          </span>
        </div>
      </div>
      <div className="mt-0.5 max-w-[4.2rem] truncate text-center text-xs text-[#e9dcc0]">{def.name}</div>
      {active && (
        <span key={`pop-${pulseKey}`} className="rise-fade pointer-events-none absolute left-1/2 top-0 z-30 whitespace-nowrap rounded bg-[#1a120e]/95 px-1.5 py-0.5 text-xs font-black text-amber-200 ring-1 ring-amber-300/60">
          {active}
        </span>
      )}
      {hover && (
        <div className="panel pointer-events-none absolute left-1/2 top-full z-50 mt-1 w-64 -translate-x-1/2 p-2 text-left text-xs text-stone-200 shadow-2xl">
          <div className="flex items-baseline justify-between">
            <b className="text-sm text-amber-100">
              {def.glyph} {def.name}
            </b>
            <span style={{ color: RARITY_THREAD[def.rarity] }}>{RARITY_KO[def.rarity]}</span>
          </div>
          <div className="mt-1 leading-snug">{def.description}</div>
          {counterText && <div className="mt-1 text-amber-300">{counterText}</div>}
        </div>
      )}
    </div>
  );
}

/** The run's talismans as hanging paper slips; the ones behind the current animation step jolt. */
export function TalismanRow({ run, current, size = 'md' }: { run: RunState; current?: AnimStep; size?: 'sm' | 'md' }): ReactElement {
  const reactions = talismanReactions(current?.step);
  const pulse = current ? `${current.chainId}-${current.step.id}` : undefined;
  return (
    <div className="panel px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="section-title">부적 {run.talismans.length}</span>
        {run.talismans.length === 0 && <span className="text-xs text-stone-500">보상과 장터에서 모으세요 — 칸 제한 없음</span>}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {run.talismans.map((t) => (
          <Slip key={t.id} id={t.id} counters={t.counters} active={reactions.get(t.id)} pulseKey={reactions.has(t.id) ? pulse : undefined} size={size} />
        ))}
      </div>
    </div>
  );
}
