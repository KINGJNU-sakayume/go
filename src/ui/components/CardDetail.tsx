import type { ReactElement } from 'react';
import { CATEGORY_KO, ENHANCEMENTS, JOKER_FORMS, MONTH_INFO, MUTATIONS, RIBBON_INFO, type CardView } from '../../game';

/** Full explanation of a card: never hide why it behaves differently. */
export function CardDetail({ view }: { view: CardView }): ReactElement {
  const matchAll = view.matchMonths.length === 12;
  return (
    <div className="w-72 space-y-2 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-base font-black">{view.name}</div>
        <div className="rounded bg-amber-500 px-1.5 text-xs font-black text-black">Lv.{view.level}</div>
      </div>
      <div className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
        <span className="text-stone-400">달 (점수)</span>
        <span>{view.scoringMonths.length ? view.scoringMonths.map((m) => `${m}월 ${MONTH_INFO[m].plantKo}`).join(' / ') : '없음'}</span>
        <span className="text-stone-400">짝 맞춤</span>
        <span>{matchAll ? '모든 달' : view.matchMonths.map((m) => `${m}월`).join(', ')}</span>
        <span className="text-stone-400">종류</span>
        <span>
          {view.categories.map((c) => CATEGORY_KO[c]).join(' + ')}
          {view.pseudoBright ? ' (유사 광)' : ''}
          {view.rainBright ? ' (비광)' : ''}
        </span>
        {view.ribbonType && (
          <>
            <span className="text-stone-400">띠 종류</span>
            <span style={{ color: RIBBON_INFO[view.ribbonType].color }}>
              {RIBBON_INFO[view.ribbonType].nameKo}
              {!view.countsAsRibbon ? ' (띠 개수 제외)' : ''}
            </span>
          </>
        )}
        <span className="text-stone-400">피 가치</span>
        <span>{view.piValue}</span>
        <span className="text-stone-400">파워</span>
        <span className="font-bold text-amber-300">{view.power}</span>
      </div>
      {view.powerParts.length > 1 && (
        <div className="rounded bg-black/30 p-1.5 text-[11px] text-stone-300">
          {view.powerParts.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{p.label}</span>
              <span>{p.value ? `+${p.value}` : ''}</span>
            </div>
          ))}
        </div>
      )}
      {view.joker && view.jokerForm && (
        <div className="rounded border border-violet-500/40 bg-violet-950/40 p-1.5 text-xs">
          <b>{JOKER_FORMS[view.jokerForm].name}</b>: {JOKER_FORMS[view.jokerForm].description}
        </div>
      )}
      {view.enhancements.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-bold text-stone-400">강화 (인챈트)</div>
          {view.enhancements.map((e, i) => (
            <div key={i} className="text-xs">
              <span className="font-bold" style={{ color: ENHANCEMENTS[e.id].color === '#475569' ? '#94a3b8' : ENHANCEMENTS[e.id].color }}>
                {ENHANCEMENTS[e.id].glyph} {ENHANCEMENTS[e.id].name}
                {e.stacks > 1 ? ` ×${e.stacks}` : ''}
                {e.month ? ` (${e.month}월)` : ''}
                {view.tempEnhancements.includes(e) ? ' · 임시' : ''}
              </span>
              : {ENHANCEMENTS[e.id].description}
            </div>
          ))}
        </div>
      )}
      {view.mutations.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-bold text-stone-400">변이</div>
          {view.mutations.map((m, i) => (
            <div key={i} className={`text-xs ${MUTATIONS[m.id].negative ? 'text-red-300' : 'text-pink-200'}`}>
              <b>
                {MUTATIONS[m.id].glyph} {MUTATIONS[m.id].name}
              </b>
              : {MUTATIONS[m.id].description}
            </div>
          ))}
        </div>
      )}
      {view.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-sky-200">
          {view.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
