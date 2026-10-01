import type { AnimalKind, CardDefinition, Month, RibbonType } from '../types';

export interface MonthInfo {
  month: Month;
  plantKo: string;
  plantEn: string;
  shortKo: string;
  /** Primary / secondary colours for the original stylized card art. */
  color: string;
  accent: string;
}

export const MONTH_INFO: Record<Month, MonthInfo> = {
  1: { month: 1, plantKo: '송학', plantEn: 'Pine', shortKo: '1월', color: '#1f6f43', accent: '#e8f5e9' },
  2: { month: 2, plantKo: '매조', plantEn: 'Plum', shortKo: '2월', color: '#c2185b', accent: '#fce4ec' },
  3: { month: 3, plantKo: '벚꽃', plantEn: 'Cherry', shortKo: '3월', color: '#e57399', accent: '#fff0f5' },
  4: { month: 4, plantKo: '흑싸리', plantEn: 'Wisteria', shortKo: '4월', color: '#3d2b56', accent: '#ede7f6' },
  5: { month: 5, plantKo: '난초', plantEn: 'Iris', shortKo: '5월', color: '#5e35b1', accent: '#ede7f6' },
  6: { month: 6, plantKo: '모란', plantEn: 'Peony', shortKo: '6월', color: '#c62828', accent: '#ffebee' },
  7: { month: 7, plantKo: '홍싸리', plantEn: 'Bush Clover', shortKo: '7월', color: '#ad1457', accent: '#fce4ec' },
  8: { month: 8, plantKo: '공산', plantEn: 'Pampas', shortKo: '8월', color: '#455a64', accent: '#eceff1' },
  9: { month: 9, plantKo: '국화', plantEn: 'Chrysanthemum', shortKo: '9월', color: '#c79100', accent: '#fff8e1' },
  10: { month: 10, plantKo: '단풍', plantEn: 'Maple', shortKo: '10월', color: '#d84315', accent: '#fbe9e7' },
  11: { month: 11, plantKo: '오동', plantEn: 'Paulownia', shortKo: '11월', color: '#4e342e', accent: '#efebe9' },
  12: { month: 12, plantKo: '비', plantEn: 'Rain', shortKo: '12월', color: '#263238', accent: '#e0f2f1' },
};

export const RIBBON_INFO: Record<RibbonType, { nameKo: string; nameEn: string; color: string }> = {
  hongdan: { nameKo: '홍단', nameEn: 'Hongdan', color: '#d32f2f' },
  cheongdan: { nameKo: '청단', nameEn: 'Cheongdan', color: '#1e56c8' },
  chodan: { nameKo: '초단', nameEn: 'Chodan', color: '#2e7d32' },
  plain: { nameKo: '띠', nameEn: 'Ribbon', color: '#8d6e63' },
};

export const ANIMAL_INFO: Record<AnimalKind, { nameKo: string; nameEn: string }> = {
  warbler: { nameKo: '꾀꼬리', nameEn: 'Warbler' },
  cuckoo: { nameKo: '두견새', nameEn: 'Cuckoo' },
  bridge: { nameKo: '나무다리', nameEn: 'Bridge' },
  butterfly: { nameKo: '나비', nameEn: 'Butterflies' },
  boar: { nameKo: '멧돼지', nameEn: 'Boar' },
  geese: { nameKo: '기러기', nameEn: 'Geese' },
  sakeCup: { nameKo: '술잔', nameEn: 'Sake Cup' },
  deer: { nameKo: '사슴', nameEn: 'Deer' },
  swallow: { nameKo: '제비', nameEn: 'Swallow' },
};

const BASE_POWER = { bright: 10, animal: 6, ribbon: 6, pi: 2, doublePi: 4, joker: 4 } as const;

function pad(month: Month): string {
  return month < 10 ? `0${month}` : `${month}`;
}

function bright(month: Month, extra: Partial<CardDefinition> = {}): CardDefinition {
  const info = MONTH_INFO[month];
  return {
    id: `m${pad(month)}-bright`,
    month,
    category: 'bright',
    nameKo: extra.rainBright ? '비광' : `${info.plantKo} 광`,
    nameEn: extra.rainBright ? 'Rain Bright' : `${info.plantEn} Bright`,
    plantKo: info.plantKo,
    plantEn: info.plantEn,
    piValue: 0,
    basePower: BASE_POWER.bright,
    ...extra,
  };
}

function animal(month: Month, kind: AnimalKind, extra: Partial<CardDefinition> = {}): CardDefinition {
  const info = MONTH_INFO[month];
  return {
    id: `m${pad(month)}-animal`,
    month,
    category: 'animal',
    nameKo: `${info.plantKo} ${ANIMAL_INFO[kind].nameKo}`,
    nameEn: `${info.plantEn} ${ANIMAL_INFO[kind].nameEn}`,
    plantKo: info.plantKo,
    plantEn: info.plantEn,
    animalKind: kind,
    piValue: 0,
    basePower: BASE_POWER.animal,
    ...extra,
  };
}

function ribbon(month: Month, type: RibbonType, extra: Partial<CardDefinition> = {}): CardDefinition {
  const info = MONTH_INFO[month];
  return {
    id: `m${pad(month)}-ribbon`,
    month,
    category: 'ribbon',
    nameKo: `${info.plantKo} ${RIBBON_INFO[type].nameKo}`,
    nameEn: `${info.plantEn} ${RIBBON_INFO[type].nameEn}`,
    plantKo: info.plantKo,
    plantEn: info.plantEn,
    ribbonType: type,
    piValue: 0,
    basePower: BASE_POWER.ribbon,
    ...extra,
  };
}

function pi(month: Month, suffix: 'a' | 'b', extra: Partial<CardDefinition> = {}): CardDefinition {
  const info = MONTH_INFO[month];
  return {
    id: `m${pad(month)}-pi-${suffix}`,
    month,
    category: 'pi',
    nameKo: `${info.plantKo} 피`,
    nameEn: `${info.plantEn} Pi`,
    plantKo: info.plantKo,
    plantEn: info.plantEn,
    piValue: 1,
    basePower: BASE_POWER.pi,
    ...extra,
  };
}

function doublePi(month: Month, extra: Partial<CardDefinition> = {}): CardDefinition {
  const info = MONTH_INFO[month];
  return {
    id: `m${pad(month)}-doublepi`,
    month,
    category: 'pi',
    nameKo: `${info.plantKo} 쌍피`,
    nameEn: `${info.plantEn} Double Pi`,
    plantKo: info.plantKo,
    plantEn: info.plantEn,
    piValue: 2,
    doublePi: true,
    basePower: BASE_POWER.doublePi,
    ...extra,
  };
}

const rain = { rain: true } as const;

/** The 48 standard cards. Data only — edit freely. */
export const STANDARD_CARDS: CardDefinition[] = [
  // January — Pine
  bright(1),
  ribbon(1, 'hongdan'),
  pi(1, 'a'),
  pi(1, 'b'),
  // February — Plum
  animal(2, 'warbler', { godori: true }),
  ribbon(2, 'hongdan'),
  pi(2, 'a'),
  pi(2, 'b'),
  // March — Cherry
  bright(3),
  ribbon(3, 'hongdan'),
  pi(3, 'a'),
  pi(3, 'b'),
  // April — Wisteria
  animal(4, 'cuckoo', { godori: true }),
  ribbon(4, 'chodan'),
  pi(4, 'a'),
  pi(4, 'b'),
  // May — Iris
  animal(5, 'bridge', { doublePiVariant: 'may' }),
  ribbon(5, 'chodan'),
  pi(5, 'a'),
  pi(5, 'b'),
  // June — Peony
  animal(6, 'butterfly'),
  ribbon(6, 'cheongdan'),
  pi(6, 'a'),
  pi(6, 'b'),
  // July — Bush clover
  animal(7, 'boar'),
  ribbon(7, 'chodan'),
  pi(7, 'a'),
  pi(7, 'b'),
  // August — Pampas
  bright(8),
  animal(8, 'geese', { godori: true }),
  pi(8, 'a'),
  pi(8, 'b'),
  // September — Chrysanthemum
  animal(9, 'sakeCup', { doublePiVariant: 'september' }),
  ribbon(9, 'cheongdan'),
  pi(9, 'a'),
  pi(9, 'b'),
  // October — Maple
  animal(10, 'deer'),
  ribbon(10, 'cheongdan'),
  pi(10, 'a'),
  pi(10, 'b'),
  // November — Paulownia
  bright(11),
  doublePi(11),
  pi(11, 'a'),
  pi(11, 'b'),
  // December — Rain
  bright(12, { rainBright: true, ...rain }),
  animal(12, 'swallow', rain),
  ribbon(12, 'plain', rain),
  doublePi(12, rain),
];

export const JOKER_DEFINITION: CardDefinition = {
  id: 'joker',
  month: null,
  category: 'joker',
  nameKo: '조커',
  nameEn: 'Joker',
  plantKo: '도깨비',
  plantEn: 'Dokkaebi',
  piValue: 2,
  basePower: BASE_POWER.joker,
};

export const ALL_CARD_DEFINITIONS: CardDefinition[] = [...STANDARD_CARDS, JOKER_DEFINITION];

const DEF_INDEX = new Map(ALL_CARD_DEFINITIONS.map((d) => [d.id, d]));

export function getCardDef(defId: string): CardDefinition {
  const def = DEF_INDEX.get(defId);
  if (!def) throw new Error(`Unknown card definition: ${defId}`);
  return def;
}

export function hasCardDef(defId: string): boolean {
  return DEF_INDEX.has(defId);
}

export function defsOfMonth(month: Month): CardDefinition[] {
  return STANDARD_CARDS.filter((d) => d.month === month);
}
