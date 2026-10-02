import { createContext, useContext, type CSSProperties } from 'react';
import type { CardView } from '../../game';
import type { CardTheme } from '../hooks/useGame';

/**
 * Linocut print card art (user-provided). `month-01.webp` is a 591×222 strip of the four January
 * cards; the rectangles below are measured from it (x, y, w, h in source pixels).
 * `months-01-03.webp` is listed in `months-01-03.json` but the file is not a decodable image,
 * so it is not used until it is re-exported.
 */
const SHEET = { src: 'assets/themes/linocut/month-01.webp', width: 591, height: 222 };

const CROPS: Record<string, [number, number, number, number]> = {
  'm01-bright': [3, 0, 137, 210],
  'm01-ribbon': [147, 0, 141, 210],
  'm01-pi-a': [296, 0, 139, 210],
  'm01-pi-b': [443, 0, 141, 210],
};

export const CardThemeContext = createContext<CardTheme>('classic');

export function useCardTheme(): CardTheme {
  return useContext(CardThemeContext);
}

/**
 * Background style that paints the linocut print for this card at `w`×`h`, or undefined when the
 * theme has no print for it — or when the card's printed identity was changed (a dyed card must
 * not show its old month's art).
 */
export function linocutArt(theme: CardTheme, view: CardView, w: number, h: number): CSSProperties | undefined {
  if (theme !== 'linocut' || view.joker) return undefined;
  const crop = CROPS[view.def.id];
  if (!crop) return undefined;
  if (view.printedMonth !== view.def.month || (view.ribbon && view.ribbonType !== view.def.ribbonType)) return undefined;
  const [x, y, cw, ch] = crop;
  const sx = w / cw;
  const sy = h / ch;
  return {
    backgroundImage: `url(${import.meta.env.BASE_URL}${SHEET.src})`,
    backgroundSize: `${SHEET.width * sx}px ${SHEET.height * sy}px`,
    backgroundPosition: `${-x * sx}px ${-y * sy}px`,
    backgroundRepeat: 'no-repeat',
  };
}
