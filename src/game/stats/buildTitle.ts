import type { JokboId, Month, RunState } from '../types';
import { ALL_JOKBO, ALL_MONTHS } from '../types';
import { getCardDef, MONTH_INFO } from '../cards/definitions';
import { computeIdentity } from '../cards/identity';

const JOKBO_NOUN: Record<JokboId, { plain: string; chain: string }> = {
  cheongdan: { plain: '청단 장인', chain: '푸른 달의 연쇄' },
  hongdan: { plain: '홍단 상인', chain: '붉은 노을의 춤' },
  chodan: { plain: '들꽃 매듭', chain: '끝없는 풀빛' },
  gwang: { plain: '다섯 빛의 군주', chain: '오광의 메아리' },
  godori: { plain: '새장지기', chain: '하늘을 덮은 새떼' },
  animal: { plain: '짐승의 숲', chain: '짐승 발자국 행진' },
  ribbon: { plain: '긴 띠의 무희', chain: '매듭의 폭풍' },
  pi: { plain: '피바다', chain: '티끌의 해일' },
  fullMonth: { plain: '한 달의 주인', chain: '달의 연쇄' },
};

export interface BuildSummary {
  title: string;
  dominantJokbo?: JokboId;
  dominantMonth?: Month;
  monthShare: number;
  jokers: number;
  mutated: number;
  deckSize: number;
}

/** Flavor title from objective run data — not a rating. */
export function buildTitle(run: RunState): BuildSummary {
  const triggers = run.stats.jokboTriggers;
  let dominant: JokboId | undefined;
  let best = 0;
  for (const j of ALL_JOKBO) {
    const n = triggers[j] ?? 0;
    if (n > best) {
      best = n;
      dominant = j;
    }
  }
  const counts = new Map<Month, number>();
  let jokers = 0;
  let mutated = 0;
  for (const c of run.deck) {
    const def = getCardDef(c.defId);
    if (def.category === 'joker') {
      jokers++;
      if (c.jokerForm && c.jokerForm !== 'service') mutated++;
      continue;
    }
    if (c.mutations.length) mutated++;
    const id = computeIdentity(c, undefined, { rules: run.rules, mostCommonMonth: 1, adjacentRange: 1 });
    for (const m of id.scoringMonths) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  let domMonth: Month | undefined;
  let domCount = 0;
  for (const m of ALL_MONTHS) {
    const n = counts.get(m) ?? 0;
    if (n > domCount) {
      domCount = n;
      domMonth = m;
    }
  }
  const monthShare = run.deck.length ? domCount / run.deck.length : 0;
  const retriggerHeavy = run.stats.longestChain >= 10;
  let noun = dominant ? (retriggerHeavy ? JOKBO_NOUN[dominant].chain : JOKBO_NOUN[dominant].plain) : '떠돌이 노름꾼';
  if (dominant === 'fullMonth' && domMonth) noun = `${MONTH_INFO[domMonth].plantKo}월의 주인`;
  if (dominant === 'gwang' && jokers >= 3) noun = '오광 도깨비';
  let prefix = '';
  if (run.deck.length <= 30) prefix = '칼로 벤 ';
  else if (mutated >= 6) prefix = '기묘한 ';
  else if (monthShare >= 0.25 && domMonth && dominant !== 'fullMonth') prefix = `${MONTH_INFO[domMonth].plantKo} `;
  let suffix = '';
  if (jokers >= 3 && dominant !== 'gwang') suffix = ' 도깨비';
  return {
    title: `${prefix}${noun}${suffix}`.trim(),
    dominantJokbo: dominant,
    dominantMonth: domMonth,
    monthShare,
    jokers,
    mutated,
    deckSize: run.deck.length,
  };
}
