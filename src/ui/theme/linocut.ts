import { createContext, useContext, type CSSProperties } from 'react';
import type { CardView } from '../../game';
import type { CardTheme } from '../hooks/useGame';

type Crop = [number, number, number, number];

interface Sheet {
  src: string;
  width: number;
  height: number;
  crops: Record<string, Crop>;
}

function contiguousCrops(ids: readonly string[], widths: readonly number[], height: number): Record<string, Crop> {
  const crops: Record<string, Crop> = {};
  let x = 0;
  ids.forEach((id, index) => {
    const width = widths[index];
    crops[id] = [x, 0, width, height];
    x += width;
  });
  return crops;
}

/**
 * Linocut print card art (user-provided).
 * January keeps the existing hand-measured strip. Months 2–12 are compact monthly strips made
 * from the four uploaded card images in the same order as STANDARD_CARDS.
 */
const SHEETS: Sheet[] = [
  {
    src: 'assets/themes/linocut/month-01.webp',
    width: 591,
    height: 222,
    crops: {
      'm01-bright': [3, 0, 137, 210],
      'm01-ribbon': [147, 0, 141, 210],
      'm01-pi-a': [296, 0, 139, 210],
      'm01-pi-b': [443, 0, 141, 210],
    },
  },
  {
    src: 'assets/themes/linocut/month-02.webp',
    width: 373,
    height: 142,
    crops: contiguousCrops(['m02-animal', 'm02-ribbon', 'm02-pi-a', 'm02-pi-b'], [95, 92, 93, 93], 142),
  },
  {
    src: 'assets/themes/linocut/month-03.webp',
    width: 376,
    height: 142,
    crops: contiguousCrops(['m03-bright', 'm03-ribbon', 'm03-pi-a', 'm03-pi-b'], [92, 94, 95, 95], 142),
  },
  {
    src: 'assets/themes/linocut/month-04.webp',
    width: 373,
    height: 142,
    crops: contiguousCrops(['m04-animal', 'm04-ribbon', 'm04-pi-a', 'm04-pi-b'], [95, 92, 93, 93], 142),
  },
  {
    src: 'assets/themes/linocut/month-05.webp',
    width: 376,
    height: 139,
    crops: contiguousCrops(['m05-animal', 'm05-ribbon', 'm05-pi-a', 'm05-pi-b'], [92, 94, 95, 95], 139),
  },
  {
    src: 'assets/themes/linocut/month-06.webp',
    width: 373,
    height: 139,
    crops: contiguousCrops(['m06-animal', 'm06-ribbon', 'm06-pi-a', 'm06-pi-b'], [95, 92, 93, 93], 139),
  },
  {
    src: 'assets/themes/linocut/month-07.webp',
    width: 376,
    height: 139,
    crops: contiguousCrops(['m07-animal', 'm07-ribbon', 'm07-pi-a', 'm07-pi-b'], [92, 94, 95, 95], 139),
  },
  {
    src: 'assets/themes/linocut/month-08.webp',
    width: 373,
    height: 139,
    crops: contiguousCrops(['m08-bright', 'm08-animal', 'm08-pi-a', 'm08-pi-b'], [95, 92, 93, 93], 139),
  },
  {
    src: 'assets/themes/linocut/month-09.webp',
    width: 376,
    height: 137,
    crops: contiguousCrops(['m09-animal', 'm09-ribbon', 'm09-pi-a', 'm09-pi-b'], [92, 94, 95, 95], 137),
  },
  {
    src: 'assets/themes/linocut/month-10.webp',
    width: 373,
    height: 137,
    crops: contiguousCrops(['m10-animal', 'm10-ribbon', 'm10-pi-a', 'm10-pi-b'], [95, 92, 93, 93], 137),
  },
  {
    src: 'assets/themes/linocut/month-11.webp',
    width: 376,
    height: 152,
    crops: contiguousCrops(['m11-bright', 'm11-doublepi', 'm11-pi-a', 'm11-pi-b'], [92, 94, 95, 95], 152),
  },
  {
    src: 'assets/themes/linocut/month-12.webp',
    width: 373,
    height: 152,
    crops: contiguousCrops(['m12-bright', 'm12-animal', 'm12-ribbon', 'm12-doublepi'], [95, 92, 93, 93], 152),
  },
];

const ART = new Map<string, { sheet: Sheet; crop: Crop }>();
for (const sheet of SHEETS) {
  for (const [id, crop] of Object.entries(sheet.crops)) ART.set(id, { sheet, crop });
}

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
  const art = ART.get(view.def.id);
  if (!art) return undefined;
  if (view.printedMonth !== view.def.month || (view.ribbon && view.ribbonType !== view.def.ribbonType)) return undefined;
  const { sheet, crop } = art;
  const [x, y, cw, ch] = crop;
  const sx = w / cw;
  const sy = h / ch;
  return {
    backgroundImage: `url(${import.meta.env.BASE_URL}${sheet.src})`,
    backgroundSize: `${sheet.width * sx}px ${sheet.height * sy}px`,
    backgroundPosition: `${-x * sx}px ${-y * sy}px`,
    backgroundRepeat: 'no-repeat',
  };
}
