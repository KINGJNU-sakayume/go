import type { ReactElement } from 'react';
import { ANIMAL_INFO, ENHANCEMENTS, JOKER_FORMS, MONTH_INFO, MUTATIONS, RIBBON_INFO, type CardView } from '../../game';
import { MonthMotif } from './CardArt';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<CardSize, { w: number; h: number }> = {
  xs: { w: 30, h: 46 },
  sm: { w: 46, h: 70 },
  md: { w: 62, h: 95 },
  lg: { w: 84, h: 129 },
};

interface CardProps {
  view: CardView;
  size?: CardSize;
  selected?: boolean;
  highlight?: boolean;
  dim?: boolean;
  covered?: boolean;
  onClick?: () => void;
  onHover?: (view: CardView | null) => void;
  className?: string;
}

function CategoryMark({ view }: { view: CardView }): ReactElement | null {
  if (view.joker) {
    const form = JOKER_FORMS[view.jokerForm ?? 'service'];
    return (
      <g>
        <circle cx="30" cy="42" r="16" fill={form.color} stroke="#fde68a" strokeWidth="2" />
        <text x="30" y="49" fontSize="18" textAnchor="middle" fill="#fde68a" fontFamily="serif" fontWeight="900">
          {form.glyph}
        </text>
      </g>
    );
  }
  const parts: ReactElement[] = [];
  if (view.bright) {
    parts.push(
      <g key="b">
        <circle cx="45" cy="17" r="10" fill={view.rainBright ? '#455a64' : '#d32f2f'} stroke="#fff3" />
        <text x="45" y="21.5" fontSize="12" textAnchor="middle" fill="#fff" fontFamily="serif" fontWeight="900">
          光
        </text>
      </g>,
    );
    if (view.def.month === 8 && view.def.category === 'bright') parts.push(<circle key="moon" cx="30" cy="40" r="13" fill="#fff8e1" opacity="0.95" />);
  }
  if (view.ribbon && view.ribbonType) {
    const info = RIBBON_INFO[view.ribbonType];
    parts.push(
      <g key="r">
        <rect x="23" y="20" width="14" height="46" rx="2" fill={info.color} stroke="#0003" />
        {view.ribbonType !== 'plain' &&
          info.nameKo.split('').map((ch, i) => (
            <text key={i} x="30" y={34 + i * 13} fontSize="10" textAnchor="middle" fill="#fff" fontWeight="900">
              {ch}
            </text>
          ))}
      </g>,
    );
  }
  if (view.animal) {
    const kind = view.def.animalKind;
    parts.push(
      <g key="a">
        <ellipse cx="30" cy="64" rx="17" ry="8" fill="#263238" opacity="0.85" />
        <text x="30" y="67.5" fontSize="8.5" textAnchor="middle" fill="#ffe082" fontWeight="700">
          {kind ? ANIMAL_INFO[kind].nameKo : '열끗'}
        </text>
      </g>,
    );
  }
  if (view.piValue >= 2 && !view.joker) {
    parts.push(
      <g key="p">
        <rect x="4" y="66" width="16" height="12" rx="3" fill="#33691e" />
        <text x="12" y="75" fontSize="8" textAnchor="middle" fill="#fff" fontWeight="900">
          {view.piValue >= 3 ? `피${view.piValue}` : '쌍'}
        </text>
      </g>,
    );
  }
  return <g>{parts}</g>;
}

export function Card({ view, size = 'md', selected, highlight, dim, covered, onClick, onHover, className = '' }: CardProps): ReactElement {
  const { w, h } = SIZES[size];
  const month = view.printedMonth;
  const info = month ? MONTH_INFO[month] : undefined;
  const border = view.joker ? '#7c3aed' : (info?.color ?? '#555');
  const months = view.scoringMonths;
  const extraMonths = months.filter((m) => m !== month);
  const dual = view.enhancements.filter((e) => e.id === 'dualMonth' && e.month).map((e) => e.month!);
  const glyphs = [...view.enhancements.map((e) => ({ g: ENHANCEMENTS[e.id].glyph, c: ENHANCEMENTS[e.id].color, k: e.id })), ...view.mutations.map((m) => ({ g: MUTATIONS[m.id].glyph, c: MUTATIONS[m.id].negative ? '#7f1d1d' : '#be185d', k: m.id }))];
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHover?.(view)}
      onMouseLeave={() => onHover?.(null)}
      className={`relative shrink-0 select-none rounded-md ${onClick ? 'card-hover cursor-pointer' : 'cursor-default'} ${selected ? 'ring-4 ring-amber-400 -translate-y-2' : ''} ${highlight ? 'glow' : ''} ${dim ? 'opacity-40' : ''} ${className}`}
      style={{ width: w, height: h }}
      aria-label={covered ? '가려진 카드' : `${view.name} Lv.${view.level}`}
    >
      {covered ? (
        <svg viewBox="0 0 60 92" width={w} height={h} className="rounded-md">
          <rect x="1" y="1" width="58" height="90" rx="6" fill="#b71c1c" stroke="#fda4af" strokeWidth="2" />
          {Array.from({ length: 10 }).map((_, i) => (
            <circle key={i} cx={8 + ((i * 13) % 48)} cy={10 + ((i * 17) % 76)} r="4" fill="#f9a8d4" opacity="0.8" />
          ))}
          <text x="30" y="52" fontSize="20" textAnchor="middle" fill="#fff" fontWeight="900">
            ?
          </text>
        </svg>
      ) : (
        <svg viewBox="0 0 60 92" width={w} height={h} className="rounded-md drop-shadow-md">
          <rect x="1" y="1" width="58" height="90" rx="6" fill={view.joker ? '#1e1b2e' : '#fbf3e4'} stroke={border} strokeWidth="2.5" />
          <g opacity={view.joker ? 0.4 : 1}>
            <MonthMotif month={month} color={info?.color ?? '#999'} />
          </g>
          <CategoryMark view={view} />
          <rect x="2" y="2" width="17" height="15" rx="4" fill={border} />
          <text x="10.5" y="13" fontSize="10" textAnchor="middle" fill="#fff" fontWeight="900">
            {month ?? '鬼'}
          </text>
          {(extraMonths.length > 0 || dual.length > 0) && (
            <g>
              <rect x="2" y="18" width="17" height="11" rx="3" fill="#0e7490" />
              <text x="10.5" y="26.5" fontSize="7" textAnchor="middle" fill="#fff" fontWeight="700">
                +{[...extraMonths, ...dual].join(',')}
              </text>
            </g>
          )}
          {view.wild && !view.joker && (
            <text x="10.5" y="40" fontSize="9" textAnchor="middle" fill="#9333ea" fontWeight="900">
              萬
            </text>
          )}
          <rect x="1" y="80" width="58" height="11" rx="0" fill="#0006" />
          <text x="30" y="88.5" fontSize="7" textAnchor="middle" fill="#fff" fontWeight="700">
            {view.name.length > 9 ? view.name.slice(0, 9) : view.name}
          </text>
        </svg>
      )}
      {!covered && view.level > 1 && (
        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-500 px-1 text-[9px] font-black text-black shadow">Lv{view.level}</span>
      )}
      {!covered && glyphs.length > 0 && size !== 'xs' && (
        <span className="absolute -bottom-1.5 left-0 right-0 flex justify-center gap-px">
          {glyphs.slice(0, 5).map((g, i) => (
            <span key={`${g.k}${i}`} className="rounded-sm px-0.5 text-[9px] font-black leading-tight text-white shadow" style={{ background: g.c }}>
              {g.g}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

export function CardBack({ size = 'md', count }: { size?: CardSize; count?: number }): ReactElement {
  const { w, h } = SIZES[size];
  return (
    <div className="relative" style={{ width: w, height: h }}>
      <svg viewBox="0 0 60 92" width={w} height={h}>
        <rect x="1" y="1" width="58" height="90" rx="6" fill="#8e1b1b" stroke="#f5d68a" strokeWidth="2" />
        <rect x="7" y="7" width="46" height="78" rx="4" fill="none" stroke="#f5d68a55" strokeWidth="1.5" />
        <text x="30" y="52" fontSize="16" textAnchor="middle" fill="#f5d68a" fontFamily="serif" fontWeight="900">
          花
        </text>
      </svg>
      {count !== undefined && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/80 px-1.5 text-xs font-bold">{count}</span>}
    </div>
  );
}
