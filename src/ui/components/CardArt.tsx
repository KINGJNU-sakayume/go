import type { ReactElement } from 'react';
import type { Month } from '../../game';

/** Original, symbolic month motifs drawn with simple SVG shapes (viewBox 0 0 60 92). */
export function MonthMotif({ month, color }: { month: Month | null; color: string }): ReactElement | null {
  switch (month) {
    case 1: // pine
      return (
        <g>
          <rect x="28" y="58" width="4" height="22" fill="#5d4037" />
          {[0, 1, 2].map((i) => (
            <polygon key={i} points={`30,${18 + i * 12} ${14 - i * 2},${40 + i * 12} ${46 + i * 2},${40 + i * 12}`} fill={color} opacity={0.85 - i * 0.12} />
          ))}
        </g>
      );
    case 2: // plum branch
      return (
        <g>
          <path d="M6 70 Q24 50 54 30" stroke="#4e342e" strokeWidth="3" fill="none" />
          {[
            [16, 58],
            [28, 47],
            [40, 40],
            [50, 32],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="6" fill={color} stroke="#fff" strokeWidth="1" />
          ))}
        </g>
      );
    case 3: // cherry blossoms
      return (
        <g>
          {[
            [18, 30],
            [40, 26],
            [30, 48],
            [14, 62],
            [46, 58],
          ].map(([x, y], i) => (
            <g key={i}>
              {[0, 72, 144, 216, 288].map((a) => (
                <circle key={a} cx={x + 4.5 * Math.cos((a * Math.PI) / 180)} cy={y + 4.5 * Math.sin((a * Math.PI) / 180)} r="3.4" fill={color} />
              ))}
              <circle cx={x} cy={y} r="1.6" fill="#fde68a" />
            </g>
          ))}
        </g>
      );
    case 4: // wisteria
      return (
        <g>
          <path d="M8 18 L52 18" stroke="#3e2723" strokeWidth="2" />
          {[14, 26, 38, 50].map((x, i) => (
            <g key={x}>
              {[0, 1, 2, 3, 4].map((k) => (
                <ellipse key={k} cx={x} cy={24 + k * 8 + (i % 2) * 4} rx="3" ry="4" fill={color} opacity={1 - k * 0.12} />
              ))}
            </g>
          ))}
        </g>
      );
    case 5: // iris
      return (
        <g>
          {[14, 24, 36, 46].map((x, i) => (
            <path key={x} d={`M${x} 80 Q${x + (i % 2 ? 6 : -6)} 50 ${x} 28`} stroke="#2e7d32" strokeWidth="3" fill="none" />
          ))}
          {[
            [20, 30],
            [40, 26],
          ].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x - 4} cy={y} rx="4" ry="7" fill={color} />
              <ellipse cx={x + 4} cy={y} rx="4" ry="7" fill={color} />
              <ellipse cx={x} cy={y - 4} rx="3" ry="6" fill="#7e57c2" />
            </g>
          ))}
        </g>
      );
    case 6: // peony
      return (
        <g>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse
              key={a}
              cx={30 + 9 * Math.cos((a * Math.PI) / 180)}
              cy={40 + 9 * Math.sin((a * Math.PI) / 180)}
              rx="9"
              ry="7"
              fill={color}
              opacity="0.9"
            />
          ))}
          <circle cx="30" cy="40" r="6" fill="#ffcdd2" />
          <path d="M14 66 Q30 58 46 66" stroke="#2e7d32" strokeWidth="4" fill="none" />
        </g>
      );
    case 7: // bush clover
      return (
        <g>
          <path d="M10 76 Q30 40 50 20" stroke="#6d4c41" strokeWidth="2" fill="none" />
          <path d="M18 76 Q24 50 44 34" stroke="#6d4c41" strokeWidth="2" fill="none" />
          {Array.from({ length: 12 }).map((_, i) => (
            <circle key={i} cx={14 + ((i * 7) % 36)} cy={24 + ((i * 11) % 50)} r="2.6" fill={color} />
          ))}
        </g>
      );
    case 8: // pampas & moon
      return (
        <g>
          <path d="M0 64 Q30 40 60 64 L60 92 L0 92 Z" fill="#37474f" opacity="0.8" />
          {[8, 18, 28, 38, 48].map((x) => (
            <path key={x} d={`M${x} 92 Q${x + 4} 70 ${x + 2} 58`} stroke="#cfd8dc" strokeWidth="1.5" fill="none" />
          ))}
        </g>
      );
    case 9: // chrysanthemum
      return (
        <g>
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i * 22.5 * Math.PI) / 180;
            return <ellipse key={i} cx={30 + 9 * Math.cos(a)} cy={38 + 9 * Math.sin(a)} rx="5" ry="2.4" transform={`rotate(${i * 22.5} ${30 + 9 * Math.cos(a)} ${38 + 9 * Math.sin(a)})`} fill={color} />;
          })}
          <circle cx="30" cy="38" r="5" fill="#ff8f00" />
        </g>
      );
    case 10: // maple leaves
      return (
        <g>
          {[
            [18, 30, 0],
            [40, 26, 20],
            [30, 50, -15],
            [46, 56, 35],
          ].map(([x, y, r], i) => (
            <polygon
              key={i}
              transform={`rotate(${r} ${x} ${y})`}
              points={`${x},${y - 10} ${x + 3},${y - 3} ${x + 10},${y - 4} ${x + 5},${y + 2} ${x + 7},${y + 9} ${x},${y + 5} ${x - 7},${y + 9} ${x - 5},${y + 2} ${x - 10},${y - 4} ${x - 3},${y - 3}`}
              fill={color}
            />
          ))}
        </g>
      );
    case 11: // paulownia
      return (
        <g>
          <path d="M30 80 L30 40" stroke="#5d4037" strokeWidth="3" />
          <ellipse cx="18" cy="38" rx="13" ry="10" fill="#6d4c41" />
          <ellipse cx="42" cy="38" rx="13" ry="10" fill="#795548" />
          {[22, 30, 38].map((x) => (
            <ellipse key={x} cx={x} cy="22" rx="3" ry="6" fill="#9575cd" />
          ))}
        </g>
      );
    case 12: // rain & willow
      return (
        <g>
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1={6 + i * 6} y1={14} x2={2 + i * 6} y2={30} stroke="#90caf9" strokeWidth="1.2" />
          ))}
          <path d="M10 20 Q20 50 14 80" stroke="#558b2f" strokeWidth="2" fill="none" />
          <path d="M48 18 Q40 50 46 80" stroke="#558b2f" strokeWidth="2" fill="none" />
        </g>
      );
    default:
      return null;
  }
}
