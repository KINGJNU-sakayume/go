import type {
  CardCategory,
  CardDefinition,
  CardInstance,
  CardView,
  EnhancementInstance,
  Month,
  RibbonType,
  RulesConfig,
  ScoringProfile,
  TempCardState,
} from '../types';
import { ALL_MONTHS } from '../types';
import { MONTH_INFO, RIBBON_INFO, getCardDef } from './definitions';
import { JOKER_FORMS } from './jokers';
import { MUTATIONS } from './mutations';

export interface IdentityContext {
  rules: RulesConfig;
  /** Most common printed month in the run deck (Moon Joker, 한철 장사). */
  mostCommonMonth: Month;
  /** Adjacent Month reach (1 normally, 2 in December's Wind weather). */
  adjacentRange: number;
}

export type CardIdentity = Omit<CardView, 'power' | 'powerParts'>;

const GODORI_MONTHS: readonly Month[] = [2, 4, 8];

export function neighborMonths(month: Month, range: number, wrap: boolean): Month[] {
  const out: Month[] = [];
  for (let d = 1; d <= range; d++) {
    for (const delta of [-d, d]) {
      let m = month + delta;
      if (wrap) m = ((m - 1 + 120) % 12) + 1;
      if (m >= 1 && m <= 12) out.push(m as Month);
    }
  }
  return out;
}

export function categoryLabelKo(view: Pick<CardView, 'categories' | 'ribbonType' | 'piValue' | 'joker'>): string {
  if (view.joker) return '조커';
  const c = view.categories;
  if (c.includes('bright')) return '광';
  if (c.includes('animal')) return '열끗';
  if (c.includes('ribbon')) return RIBBON_INFO[view.ribbonType ?? 'plain'].nameKo;
  if (view.piValue >= 2) return '쌍피';
  return '피';
}

export const CATEGORY_KO: Record<CardCategory, string> = {
  bright: '광',
  animal: '열끗',
  ribbon: '띠',
  pi: '피',
  joker: '조커',
};

export function hasEnhancement(enhancements: EnhancementInstance[], id: EnhancementInstance['id']): boolean {
  return enhancements.some((e) => e.id === id);
}

/** Computes everything about a card except its power (which depends on effect hooks). */
export function computeIdentity(card: CardInstance, temp: TempCardState | undefined, ctx: IdentityContext): CardIdentity {
  const def: CardDefinition = getCardDef(card.defId);
  const tempEnh = temp?.enhancements ?? [];
  const enhancements = [...card.enhancements, ...tempEnh];
  const muts = card.mutations;
  const notes: string[] = [];
  const level = card.level + (temp?.levelBonus ?? 0);
  if (temp?.levelBonus) notes.push(`임시 레벨 +${temp.levelBonus} (이번 스테이지)`);

  const joker = def.category === 'joker';
  const jokerForm = joker ? (card.jokerForm ?? 'service') : undefined;

  // --- printed month & ribbon identity ---
  let printed: Month | null = def.month;
  let ribbonType: RibbonType | undefined = def.ribbonType;
  let dyed = false;
  for (const m of muts) {
    if (m.id === 'monthShift' && m.month) {
      notes.push(`달 바꾸기: 원래 ${def.month}월 → ${m.month}월`);
      printed = m.month;
    }
    if (m.id === 'ribbonDye' && m.ribbonType && m.month) {
      notes.push(
        `띠 염색: ${RIBBON_INFO[def.ribbonType ?? 'plain'].nameKo} → ${m.month}월 ${RIBBON_INFO[m.ribbonType].nameKo}`,
      );
      ribbonType = m.ribbonType;
      printed = m.month;
      dyed = true;
    }
  }
  if (jokerForm === 'moon') {
    printed = temp?.moonMonth ?? ctx.mostCommonMonth;
    notes.push(`달 조커: 덱에서 가장 흔한 달(${printed}월)로 취급`);
  }

  // --- scoring months ---
  const scoring = new Set<Month>();
  if (printed) scoring.add(printed);
  for (const m of muts) {
    if (m.id === 'splitMoon' && m.month) {
      scoring.add(m.month);
      notes.push(`갈라진 달: ${m.month}월로도 취급 (매칭 + 점수)`);
    }
    if (m.id === 'tripleMoon' && m.months) {
      for (const mm of m.months) scoring.add(mm);
      notes.push(`세 겹 달: ${m.months.join('·')}월로도 취급 (매칭 + 점수)`);
    }
  }
  if (temp?.copied) {
    for (const mm of temp.copied.months) scoring.add(mm);
    notes.push(`복사: ${temp.copied.fromName}의 태그를 복사함`);
  }
  const scoringMonths = Array.from(scoring).sort((a, b) => a - b);

  // --- categories ---
  const cats = new Set<CardCategory>([def.category]);
  let grafted = false;
  for (const m of muts) {
    if (m.id === 'typeGraft' && m.category) {
      if (!cats.has(m.category)) {
        cats.add(m.category);
        grafted = true;
        notes.push(`종류 접목: ${CATEGORY_KO[m.category]}로도 셈`);
      }
    }
    if (m.id === 'brightAscension') {
      cats.add('bright');
      notes.push('광 승천: 유사 광으로 셈');
    }
    if (m.id === 'piCompression') cats.add('pi');
  }
  const copied = temp?.copied;
  if (copied) {
    if (copied.bright) cats.add('bright');
    if (copied.animal) cats.add('animal');
    if (copied.countsAsRibbon || copied.ribbonTypes.length) cats.add('ribbon');
    if (copied.pi > 0) cats.add('pi');
  }

  const clearSky = muts.some((m) => m.id === 'clearSky');
  const bright = cats.has('bright');
  let rainBright = bright && !!def.rainBright && !clearSky;
  if (copied?.rainBright) rainBright = true;
  if (def.rainBright && clearSky) notes.push('갠 하늘: 비광 취급 안 됨');
  const pseudoBright = bright && def.category !== 'bright';

  const ribbon = cats.has('ribbon');
  if (ribbon && !ribbonType) ribbonType = 'plain';
  const isRainRibbon = def.id === 'm12-ribbon' && !dyed && ribbonType === 'plain';
  let countsAsRibbon = ribbon && !(isRainRibbon && !ctx.rules.rainRibbonCountsAsRibbon);
  if (copied?.countsAsRibbon) countsAsRibbon = true;
  if (isRainRibbon && !countsAsRibbon) notes.push('비 띠: 띠 개수 족보에 포함되지 않음 (규칙 설정)');

  const animal = cats.has('animal');
  const godori = animal && scoringMonths.some((m) => GODORI_MONTHS.includes(m));

  // --- pi value ---
  let piValue = 0;
  if (joker && jokerForm) {
    piValue = jokerForm === 'service' ? ctx.rules.jokerPiValue : JOKER_FORMS[jokerForm].piValue;
  } else if (def.category === 'pi') {
    piValue = def.doublePi ? ctx.rules.doublePiValue : 1;
  }
  if (
    (def.doublePiVariant === 'may' && ctx.rules.mayAnimalDoublePi) ||
    (def.doublePiVariant === 'september' && ctx.rules.septemberAnimalDoublePi)
  ) {
    piValue += ctx.rules.doublePiValue;
    cats.add('pi');
    notes.push('규칙 변형: 쌍피로도 셈');
  }
  for (const m of muts) {
    if (m.id === 'piCompression') {
      piValue += m.amount ?? 2;
      notes.push(`피 압축: 피 가치 +${m.amount ?? 2}`);
    }
  }
  if (copied) piValue = Math.max(piValue, copied.pi);
  if (def.doublePi && ctx.rules.doublePiValue !== 2) notes.push(`쌍피 가치 ${ctx.rules.doublePiValue}`);

  // --- matching ---
  const wild = joker || hasEnhancement(enhancements, 'wildMonth');
  const match = new Set<Month>(scoringMonths);
  const dualMonths: Month[] = [];
  for (const e of enhancements) {
    if (e.id === 'dualMonth' && e.month) {
      match.add(e.month);
      dualMonths.push(e.month);
      notes.push(`두 달: ${e.month}월과도 짝 (매칭 전용)`);
    }
  }
  if (hasEnhancement(enhancements, 'adjacentMonth')) {
    for (const s of scoringMonths) for (const n of neighborMonths(s, ctx.adjacentRange, ctx.rules.wrapAdjacentMonths)) match.add(n);
    notes.push(`이웃 달: 앞뒤 ${ctx.adjacentRange}달과도 짝`);
  }
  if (joker) notes.push('조커: 필드의 어떤 달과도 짝');
  else if (wild) notes.push(`만월: 어떤 달과도 짝, 점수는 ${scoringMonths.join('·')}월로 계산`);
  const matchMonths = wild ? [...ALL_MONTHS] : Array.from(match).sort((a, b) => a - b);

  const negative = muts.some((m) => MUTATIONS[m.id].negative) || hasEnhancement(enhancements, 'cursed');
  const multiMonth = new Set<Month>([...scoringMonths, ...dualMonths]).size > 1;

  const categories = Array.from(cats);
  const view: CardIdentity = {
    card,
    def,
    name: '',
    level,
    printedMonth: printed,
    scoringMonths,
    matchMonths,
    wild,
    categories,
    ribbonType: ribbon ? ribbonType : undefined,
    bright,
    rainBright,
    pseudoBright,
    animal,
    ribbon,
    countsAsRibbon,
    piValue,
    joker,
    jokerForm,
    godori,
    enhancements,
    tempEnhancements: tempEnh,
    mutations: muts,
    negative,
    multiMonth,
    notes,
  };
  view.name = displayName(view, grafted);
  return view;
}

function displayName(view: CardIdentity, grafted: boolean): string {
  const def = view.def;
  if (view.joker) {
    return JOKER_FORMS[view.jokerForm ?? 'service'].name;
  }
  const changed = view.printedMonth !== def.month || (view.ribbon && view.ribbonType !== def.ribbonType);
  let base = def.nameKo;
  if (changed && view.printedMonth) {
    base = `${MONTH_INFO[view.printedMonth].plantKo} ${categoryLabelKo({ ...view, categories: [def.category, ...view.categories.filter((c) => c !== def.category)] })}`;
  }
  return grafted ? `${base}*` : base;
}

export function toScoringProfile(view: CardView, temp: TempCardState | undefined): ScoringProfile {
  const ribbonTypes = new Set<RibbonType>();
  if (view.ribbon && view.ribbonType) ribbonTypes.add(view.ribbonType);
  if (temp?.copied) for (const r of temp.copied.ribbonTypes) ribbonTypes.add(r);
  return {
    uid: view.card.uid,
    defId: view.def.id,
    months: view.scoringMonths,
    bright: view.bright,
    rainBright: view.rainBright,
    animal: view.animal,
    ribbonTypes: Array.from(ribbonTypes),
    countsAsRibbon: view.countsAsRibbon,
    pi: view.piValue,
    joker: view.joker,
    forcedSlots: temp?.impostor ? [{ jokboId: temp.impostor.jokboId, slotIndex: temp.impostor.slotIndex }] : [],
    level: view.level,
    power: view.power,
    enhanced: view.enhancements.length > 0,
  };
}

/** Most common printed month across a deck (ties → lowest month). */
export function mostCommonMonthOf(cards: CardInstance[], ctx: Omit<IdentityContext, 'mostCommonMonth'>): Month {
  const counts = new Map<Month, number>();
  for (const card of cards) {
    const def = getCardDef(card.defId);
    if (def.category === 'joker') continue;
    const id = computeIdentity(card, undefined, { ...ctx, mostCommonMonth: 1 });
    if (id.printedMonth) counts.set(id.printedMonth, (counts.get(id.printedMonth) ?? 0) + 1);
  }
  let best: Month = 1;
  let bestCount = -1;
  for (const m of ALL_MONTHS) {
    const c = counts.get(m) ?? 0;
    if (c > bestCount) {
      best = m;
      bestCount = c;
    }
  }
  return best;
}
