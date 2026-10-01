export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const ALL_MONTHS: readonly Month[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function isMonth(value: number): value is Month {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

export type CardCategory = 'bright' | 'animal' | 'ribbon' | 'pi' | 'joker';

export const ALL_CATEGORIES: readonly CardCategory[] = ['bright', 'animal', 'ribbon', 'pi', 'joker'];

/** 'plain' is the December (rain) ribbon, which belongs to no ribbon set. */
export type RibbonType = 'hongdan' | 'cheongdan' | 'chodan' | 'plain';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'mythic'];

export type JokboId =
  | 'gwang'
  | 'godori'
  | 'animal'
  | 'ribbon'
  | 'hongdan'
  | 'cheongdan'
  | 'chodan'
  | 'pi'
  | 'fullMonth';

export const ALL_JOKBO: readonly JokboId[] = [
  'gwang',
  'godori',
  'animal',
  'hongdan',
  'cheongdan',
  'chodan',
  'ribbon',
  'pi',
  'fullMonth',
];

export type JokboGroup = 'bright' | 'animal' | 'ribbon' | 'ribbonSet' | 'pi' | 'month';

export type AnimalKind =
  | 'warbler'
  | 'cuckoo'
  | 'bridge'
  | 'butterfly'
  | 'boar'
  | 'geese'
  | 'sakeCup'
  | 'deer'
  | 'swallow';

export type EnhancementId =
  | 'reinforced'
  | 'golden'
  | 'echo'
  | 'dualMonth'
  | 'adjacentMonth'
  | 'wildMonth'
  | 'bloom'
  | 'collector'
  | 'catalyst'
  | 'hollow'
  | 'lucky'
  | 'cursed';

export type MutationId =
  | 'monthShift'
  | 'splitMoon'
  | 'tripleMoon'
  | 'typeGraft'
  | 'ribbonDye'
  | 'brightAscension'
  | 'piCompression'
  | 'mirror'
  | 'parasite'
  | 'rebirth'
  | 'clearSky'
  // negative mutations (curses)
  | 'withered'
  | 'stubborn'
  | 'illOmen'
  | 'greedy';

export type JokerFormId = 'service' | 'universal' | 'mirror' | 'impostor' | 'echo' | 'moon' | 'empty';

export type Weather = 'rain' | 'wind' | 'frost' | 'clear';

export type BuildTag =
  | 'month'
  | 'ribbon'
  | 'cheongdan'
  | 'hongdan'
  | 'chodan'
  | 'bright'
  | 'animal'
  | 'godori'
  | 'pi'
  | 'thin'
  | 'joker'
  | 'retrigger'
  | 'economy'
  | 'exchange'
  | 'mutation'
  | 'rainbow';
