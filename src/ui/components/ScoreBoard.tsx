import { useEffect, useRef, useState, type ReactElement } from 'react';
import { BALANCE, WEATHER_INFO, shakeFactor, type RunState, type ScoreBreakdown } from '../../game';
import type { AnimStep } from '../hooks/useChainAnimation';
import { fmt } from '../views';
import { Seal } from './Seal';

/** Counts up (or down) to `value` over a short ease-out instead of jumping. */
export function useRolling(value: number, ms = 360): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const v = a + (value - a) * (1 - Math.pow(1 - t, 3));
      setShown(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

interface Shown {
  key: string;
  label: string;
  sub?: string;
  kkut?: number;
  bae?: number;
  total: number;
}

function fromStep(a: AnimStep): Shown | undefined {
  const s = a.step;
  if (!s.value || !['capture', 'score', 'special'].includes(s.kind)) return undefined;
  const b: ScoreBreakdown | undefined = s.breakdown;
  return {
    key: `${a.chainId}-${s.id}`,
    label: s.title,
    sub: b?.entries[0]?.kind === 'base' ? b.entries[0].source : undefined,
    kkut: b ? b.base + b.power + b.flat : undefined,
    bae: b ? Math.round(b.jokboMult * b.globalMult * 100) / 100 : undefined,
    total: s.value,
  };
}

/** Stage-wide multipliers ("판 배"): 흔들기, 고, stage bonuses, month multipliers, weather. */
function panStamps(run: RunState): { text: string; tone: 'red' | 'ink' | 'gold' | 'indigo'; title: string }[] {
  const st = run.stage!;
  const out: { text: string; tone: 'red' | 'ink' | 'gold' | 'indigo'; title: string }[] = [];
  if (st.shakeCount > 0)
    out.push({
      text: `흔들기 ×${shakeFactor(st.shakeCount)}`,
      tone: 'red',
      title: `흔들기 ${st.shakeCount}회 — 선언 뒤 얻는 점수 ×${shakeFactor(st.shakeCount)} (최대 ×${shakeFactor(BALANCE.shakeMaxStacks)})`,
    });
  if (st.goCount > 0)
    out.push({ text: `${st.goCount}고 배 +${st.goCount * BALANCE.goMultAdd}`, tone: 'red', title: '고 1번마다 이후 점수의 배 +0.5' });
  const add = run.modifiers.permanentGlobalAdd + st.globalMultAdd;
  if (add) out.push({ text: `판 배 +${Math.round(add * 100) / 100}`, tone: 'gold', title: '부적·이벤트로 붙은 판 전체 배율' });
  if (st.globalMultFactor !== 1) out.push({ text: `판 배 ×${Math.round(st.globalMultFactor * 100) / 100}`, tone: 'gold', title: '스테이지 전체 배율' });
  for (const [m, v] of Object.entries(st.monthMult)) if (v && v !== 1) out.push({ text: `${m}월 ×${v}`, tone: 'indigo', title: `${m}월 카드 획득 점수 배율` });
  return out;
}

/**
 * 끗 × 배 scoreboard. Every score is (끗: base + power + flat) × (배: Jokbo × stage multipliers);
 * the last scoring event stays on the board until the next one.
 */
export function ScoreBoard({ run, displayedScore, current }: { run: RunState; displayedScore: number; current?: AnimStep }): ReactElement {
  const st = run.stage!;
  const rolled = useRolling(displayedScore);
  const [last, setLast] = useState<Shown | undefined>();
  useEffect(() => {
    const s = current ? fromStep(current) : undefined;
    if (s) setLast(s);
  }, [current]);
  useEffect(() => setLast(undefined), [st.stageIndex, run.seed]);

  const line = st.goLine ?? st.target;
  const max = Math.max(line, displayedScore) * 1.08;
  const pct = Math.min(1, displayedScore / max);
  const targetPct = st.target / max;
  const linePct = line / max;
  const cleared = displayedScore >= line;
  const stamps = panStamps(run);
  const weather = st.weather ? WEATHER_INFO[st.weather] : undefined;

  return (
    <div className="panel flex flex-wrap items-stretch gap-3 p-2.5">
      {/* 판 점수 */}
      <div className="min-w-[13rem] flex-1">
        <div className="flex items-baseline justify-between">
          <span className="section-title">판 점수</span>
          <span className="text-xs text-stone-300">
            {st.goLine ? (
              <>
                <b className="text-red-300">고 기준선 {fmt(st.goLine)}</b> · 목표 {fmt(st.target)}
              </>
            ) : (
              <>목표 {fmt(st.target)}</>
            )}
          </span>
        </div>
        <div className={`text-4xl font-black tabular-nums ${cleared ? 'text-amber-300' : 'text-[#f6ead2]'}`} style={{ fontFamily: 'var(--font-serif)' }}>
          {fmt(rolled)}
        </div>
        <div className="relative mt-1 h-3 overflow-hidden rounded-sm bg-black/50 ring-1 ring-amber-200/15">
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${pct * 100}%`, background: cleared ? 'linear-gradient(90deg,#c9a25c,#e8c77e)' : 'linear-gradient(90deg,#7a1610,#b8261c)' }}
          />
          <div className="absolute inset-y-0 w-0.5 bg-amber-100/80" style={{ left: `${targetPct * 100}%` }} title="목표" />
          {st.goLine && <div className="absolute inset-y-0 w-0.5 bg-red-300" style={{ left: `${linePct * 100}%` }} title="고 기준선" />}
        </div>
      </div>

      {/* 끗 × 배 = 점 */}
      <div className="flex min-w-[17rem] flex-[1.3] items-center justify-center gap-2" title="점수 = 끗(기본 점수 + 카드 파워 + 고정 점수) × 배(족보 배율 × 판 배율)">
        <div key={`k-${last?.key}`} className={`hanji flex h-16 w-24 flex-col items-center justify-center rounded ${last ? 'pop-in' : ''}`}>
          <span className="text-[11px] font-bold tracking-wide text-[#7a5a3a]">끗</span>
          <span className="text-2xl font-black tabular-nums" style={{ fontFamily: 'var(--font-serif)' }}>
            {last?.kkut !== undefined ? fmt(last.kkut) : '–'}
          </span>
        </div>
        <span className="text-2xl font-black text-stone-400">×</span>
        <div
          key={`b-${last?.key}`}
          className={`flex h-16 w-20 flex-col items-center justify-center rounded text-[#fff2e6] ${last ? 'pop-in' : ''}`}
          style={{ background: 'var(--vermilion)', boxShadow: 'inset 0 0 0 2px rgba(255,220,200,0.45)' }}
        >
          <span className="text-[11px] font-bold tracking-wide text-red-100/80">배</span>
          <span className="text-2xl font-black tabular-nums" style={{ fontFamily: 'var(--font-serif)' }}>
            {last?.bae !== undefined ? last.bae : '–'}
          </span>
        </div>
        <span className="text-2xl font-black text-stone-400">=</span>
        <div className="min-w-[6.5rem]">
          <div key={`t-${last?.key}`} className={`text-2xl font-black tabular-nums text-amber-300 ${last ? 'thump' : ''}`} style={{ fontFamily: 'var(--font-serif)' }}>
            {last ? `+${fmt(last.total)}` : '+0'}
          </div>
          <div className="max-w-[9rem] truncate text-xs text-stone-300">{last ? last.label : '짝을 맞추면 점수가 납니다'}</div>
          {last?.sub && <div className="max-w-[9rem] truncate text-[11px] text-stone-500">{last.sub}</div>}
        </div>
      </div>

      {/* 판 배 stamps */}
      <div className="flex min-w-[9rem] flex-col justify-center gap-1">
        <span className="section-title">판 배</span>
        <div className="flex flex-wrap gap-1">
          {stamps.length === 0 && !weather && <span className="text-xs text-stone-500">없음 (×1)</span>}
          {stamps.map((s) => (
            <span
              key={s.text}
              title={s.title}
              className="stamp-in rounded-sm px-1.5 py-0.5 text-xs font-black"
              style={{
                color: '#fff2e6',
                background: { red: '#b8261c', ink: '#1a1410', gold: '#8a6726', indigo: '#2b3f73' }[s.tone],
                boxShadow: 'inset 0 0 0 1.5px rgba(255,230,210,0.5)',
              }}
            >
              {s.text}
            </span>
          ))}
          {weather && (
            <span className="flex items-center gap-1 text-xs text-stone-300" title={weather.description}>
              <Seal char={weather.glyph} size={20} tone="indigo" /> {weather.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
