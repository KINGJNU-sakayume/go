import { useMemo, useState, type ReactElement } from 'react';
import { ALL_MONTHS, MONTH_INFO, type CardView, type RunState } from '../../game';
import { Card } from '../components/Card';
import { useCardHover } from '../components/Hover';
import { Modal } from '../components/Modal';
import { makeDeckViewFn } from '../views';

export type FilterKey = 'all' | 'bright' | 'animal' | 'ribbon' | 'pi' | 'joker' | 'enhanced' | 'mutated' | `m${number}`;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'bright', label: '광' },
  { key: 'animal', label: '열끗' },
  { key: 'ribbon', label: '띠' },
  { key: 'pi', label: '피' },
  { key: 'joker', label: '조커' },
  { key: 'enhanced', label: '강화됨' },
  { key: 'mutated', label: '변이됨' },
];

export function applyCardFilter(uids: string[], view: (u: string) => CardView, f: FilterKey): string[] {
  return uids.filter((u) => {
    const v = view(u);
    switch (f) {
      case 'all':
        return true;
      case 'bright':
        return v.bright;
      case 'animal':
        return v.animal;
      case 'ribbon':
        return v.ribbon;
      case 'pi':
        return v.piValue > 0 && !v.joker;
      case 'joker':
        return v.joker;
      case 'enhanced':
        return v.enhancements.length > 0;
      case 'mutated':
        return v.mutations.length > 0;
      default:
        return v.scoringMonths.includes(Number(f.slice(1)) as 1);
    }
  });
}

export function CardFilterBar({ value, onChange }: { value: FilterKey; onChange: (f: FilterKey) => void }): ReactElement {
  return (
    <div className="mb-2 flex flex-wrap gap-1">
      {FILTERS.map((f) => (
        <button key={f.key} type="button" className={`rounded px-2 py-0.5 text-xs ${value === f.key ? 'bg-amber-500 text-black' : 'bg-white/10'}`} onClick={() => onChange(f.key)}>
          {f.label}
        </button>
      ))}
      <select className="rounded bg-stone-800 px-1 text-xs" value={value.startsWith('m') ? value : ''} onChange={(e) => onChange((e.target.value || 'all') as FilterKey)}>
        <option value="">달 선택</option>
        {ALL_MONTHS.map((m) => (
          <option key={m} value={`m${m}`}>
            {m}월 {MONTH_INFO[m].plantKo}
          </option>
        ))}
      </select>
    </div>
  );
}

function slotCount(views: CardView[], type: string, months: number[]): number {
  return views.filter((v) => v.ribbonType === type && v.scoringMonths.some((m) => months.includes(m))).length;
}

export function DeckStats({ run }: { run: RunState }): ReactElement {
  const view = useMemo(() => makeDeckViewFn(run), [run]);
  const views = run.deck.map((c) => view(c.uid));
  const n = views.length;
  const byMonth = ALL_MONTHS.map((m) => views.filter((v) => v.scoringMonths.includes(m)).length);
  const maxMonth = Math.max(1, ...byMonth);
  const cats = [
    ['광', views.filter((v) => v.bright).length],
    ['열끗', views.filter((v) => v.animal).length],
    ['띠', views.filter((v) => v.ribbon).length],
    ['피', views.filter((v) => v.piValue > 0 && !v.joker).length],
    ['조커', views.filter((v) => v.joker).length],
  ] as const;
  const density = [
    ['청단 밀도', slotCount(views, 'cheongdan', [6, 9, 10])],
    ['홍단 밀도', slotCount(views, 'hongdan', [1, 2, 3])],
    ['초단 밀도', slotCount(views, 'chodan', [4, 5, 7])],
    ['고도리 밀도', views.filter((v) => v.godori).length],
    ['광 밀도', views.filter((v) => v.bright).length],
    ['피 밀도', views.reduce((s, v) => s + (v.joker ? 0 : v.piValue), 0)],
  ] as const;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div>
        <div className="mb-1 text-sm font-bold">총 {n}장 · 달 분포</div>
        <div className="space-y-px">
          {ALL_MONTHS.map((m, i) => (
            <div key={m} className="flex items-center gap-1 text-xs">
              <span className="w-10 text-stone-400">{m}월</span>
              <div className="h-2 flex-1 rounded bg-stone-800">
                <div className="h-full rounded" style={{ width: `${(byMonth[i] / maxMonth) * 100}%`, background: MONTH_INFO[m].color }} />
              </div>
              <span className="w-5 text-right">{byMonth[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-sm font-bold">종류 분포</div>
        {cats.map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span className="text-stone-400">{k}</span>
            <b>{v}</b>
          </div>
        ))}
        <div className="mt-1 text-xs text-stone-500">다중 종류 카드는 각 종류에 모두 셈.</div>
      </div>
      <div>
        <div className="mb-1 text-sm font-bold">족보 재료 밀도</div>
        {density.map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span className="text-stone-400">{k}</span>
            <b>
              {v} <span className="text-xs font-normal text-stone-500">({((v / Math.max(1, n)) * 100).toFixed(0)}%)</span>
            </b>
          </div>
        ))}
        <div className="mt-1 text-xs text-stone-500">정답 빌드는 알려주지 않습니다 — 숫자만 보여줍니다.</div>
      </div>
    </div>
  );
}

export function DeckViewer({ run, onClose }: { run: RunState; onClose: () => void }): ReactElement {
  const [filter, setFilter] = useState<FilterKey>('all');
  const view = useMemo(() => makeDeckViewFn(run), [run]);
  const hover = useCardHover();
  const uids = applyCardFilter(
    [...run.deck].sort((a, b) => (view(a.uid).printedMonth ?? 13) - (view(b.uid).printedMonth ?? 13)).map((c) => c.uid),
    view,
    filter,
  );
  return (
    <Modal wide onClose={onClose}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xl font-black text-amber-300">런 덱</div>
        <button type="button" className="btn btn-dark text-xs" onClick={onClose}>
          닫기
        </button>
      </div>
      <DeckStats run={run} />
      <div className="mt-3">
        <CardFilterBar value={filter} onChange={setFilter} />
        <div className="flex flex-wrap gap-2">
          {uids.map((u) => (
            <Card key={u} view={view(u)} size="md" onHover={hover} />
          ))}
        </div>
      </div>
    </Modal>
  );
}
