import type {
  JokboDefinition,
  JokboEvaluation,
  JokboId,
  JokboRule,
  Month,
  ScoringProfile,
  SlotSpec,
} from '../types';
import { ALL_JOKBO, ALL_MONTHS } from '../types';
import { JOKBO_DEFS } from './definitions';

export interface JokboEvalRules {
  rainBrightPenalty: boolean;
}

function canFillSlot(p: ScoringProfile, slot: SlotSpec, jokboId: JokboId, slotIndex: number): boolean {
  if (p.forcedSlots.some((f) => f.jokboId === jokboId && f.slotIndex === slotIndex)) return true;
  if (!p.months.includes(slot.month)) return false;
  switch (slot.need) {
    case 'ribbon':
      return !!slot.ribbonType && p.ribbonTypes.includes(slot.ribbonType);
    case 'animal':
      return p.animal;
    case 'bright':
      return p.bright;
  }
}

/** All minimal multisets of masks whose OR covers `full`. */
function minimalCovers(slotCount: number): number[][] {
  const full = (1 << slotCount) - 1;
  const masks: number[] = [];
  for (let m = 1; m <= full; m++) masks.push(m);
  const out: number[][] = [];
  const seen = new Set<string>();
  const rec = (start: number, chosen: number[], acc: number) => {
    if (acc === full) {
      const minimal = chosen.every((_, i) => chosen.reduce((a, m, j) => (j === i ? a : a | m), 0) !== full);
      if (minimal) {
        const key = chosen.join(',');
        if (!seen.has(key)) {
          seen.add(key);
          out.push([...chosen]);
        }
      }
      return;
    }
    if (chosen.length >= slotCount) return;
    for (let i = start; i < masks.length; i++) {
      chosen.push(masks[i]);
      rec(i, chosen, acc | masks[i]);
      chosen.pop();
    }
  };
  rec(0, [], 0);
  // prefer patterns that use fewer cards first
  return out.sort((a, b) => a.length - b.length);
}

const COVER_CACHE = new Map<number, number[][]>();
function coversFor(slotCount: number): number[][] {
  let c = COVER_CACHE.get(slotCount);
  if (!c) {
    c = minimalCovers(slotCount);
    COVER_CACHE.set(slotCount, c);
  }
  return c;
}

/** Maximum number of disjoint complete sets given card capability masks. */
export function maxDisjointSets(masks: number[], slotCount: number): number {
  const full = (1 << slotCount) - 1;
  const counts = new Array<number>(full + 1).fill(0);
  for (const m of masks) if (m > 0) counts[m & full]++;
  const covers = coversFor(slotCount);
  const memo = new Map<string, number>();
  const rec = (c: number[]): number => {
    const key = c.join(',');
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let best = 0;
    for (const pattern of covers) {
      const need = new Array<number>(full + 1).fill(0);
      for (const m of pattern) need[m]++;
      let ok = true;
      for (let m = 1; m <= full; m++) if (need[m] > c[m]) ok = false;
      if (!ok) continue;
      const next = c.map((v, m) => v - need[m]);
      best = Math.max(best, 1 + rec(next));
      if (pattern.length === 1 && best > 0) {
        // using a self-sufficient card alone is always optimal for that card
        break;
      }
    }
    memo.set(key, best);
    return best;
  };
  return rec(counts);
}

function evaluateSet(
  jokboId: JokboId,
  rule: Extract<JokboRule, { kind: 'set' }>,
  profiles: ScoringProfile[],
  triggerUid?: string,
): JokboEvaluation {
  const n = rule.slots.length;
  const caps = profiles
    .map((p) => {
      let mask = 0;
      rule.slots.forEach((slot, i) => {
        if (canFillSlot(p, slot, jokboId, i)) mask |= 1 << i;
      });
      return { p, mask };
    })
    .filter((c) => c.mask > 0);
  const sets = maxDisjointSets(
    caps.map((c) => c.mask),
    n,
  );
  const effectiveSets = rule.repeatable ? sets : Math.min(sets, 1);
  // per-slot capacity → display of the next set's progress
  const slotCap = rule.slots.map((_, i) => caps.filter((c) => c.mask & (1 << i)).length);
  const slots = slotCap.map((cap) => cap > effectiveSets);
  const anyFilled = slotCap.map((cap) => cap > 0);
  const progress = sets > 0 ? slots.filter(Boolean).length : anyFilled.filter(Boolean).length;

  // contributors: one card per slot, preferring the trigger card, then highest power
  const setMembers: string[] = [];
  if (sets > 0) {
    const used = new Set<string>();
    const ordered = [...caps].sort((a, b) => {
      if (a.p.uid === triggerUid) return -1;
      if (b.p.uid === triggerUid) return 1;
      return b.p.power - a.p.power;
    });
    rule.slots.forEach((_, i) => {
      const pickAlready = ordered.find((c) => used.has(c.p.uid) && c.mask & (1 << i));
      if (pickAlready) return;
      const pick = ordered.find((c) => !used.has(c.p.uid) && c.mask & (1 << i));
      if (pick) {
        used.add(pick.p.uid);
        setMembers.push(pick.p.uid);
      }
    });
  }

  return {
    points: effectiveSets * rule.pointsPerSet,
    progress: sets > 0 ? progress : anyFilled.filter(Boolean).length,
    needed: n,
    members: caps.map((c) => c.p.uid),
    sets: effectiveSets,
    slots: sets > 0 ? slots : anyFilled,
    setMembers,
  };
}

function evaluateCount(
  rule: Extract<JokboRule, { kind: 'count' }>,
  profiles: ScoringProfile[],
): JokboEvaluation {
  let value = 0;
  const members: string[] = [];
  for (const p of profiles) {
    if (rule.measure === 'animal' && p.animal) {
      value += 1;
      members.push(p.uid);
    } else if (rule.measure === 'ribbon' && p.countsAsRibbon) {
      value += 1;
      members.push(p.uid);
    } else if (rule.measure === 'pi' && p.pi > 0) {
      value += p.pi;
      members.push(p.uid);
    }
  }
  const points = value >= rule.threshold ? rule.basePoints + (value - rule.threshold) * rule.perExtra : 0;
  return {
    points,
    progress: value,
    needed: rule.threshold,
    members,
    sets: points > 0 ? 1 : 0,
    setMembers: members,
  };
}

function evaluateGwang(
  rule: Extract<JokboRule, { kind: 'gwang' }>,
  profiles: ScoringProfile[],
  rules: JokboEvalRules,
): JokboEvaluation {
  const brights = profiles.filter((p) => p.bright);
  const n = brights.length;
  const hasRain = brights.some((p) => p.rainBright);
  let points = 0;
  let tierLabel: string | undefined;
  const tier = (id: string) => rule.tiers.find((t) => t.id === id);
  if (n >= 5) {
    const t = tier('ogwang');
    points = (t?.points ?? 15) + (n - 5) * rule.perExtraBeyondFive;
    tierLabel = n > 5 ? `${t?.name ?? '오광'}+${n - 5}` : t?.name;
  } else if (n === 4) {
    const t = tier('sagwang');
    points = t?.points ?? 4;
    tierLabel = t?.name;
  } else if (n === 3) {
    if (hasRain && rules.rainBrightPenalty) {
      const t = tier('bisamgwang');
      points = t?.points ?? 2;
      tierLabel = t?.name;
    } else {
      const t = tier('samgwang');
      points = t?.points ?? 3;
      tierLabel = t?.name;
    }
  }
  return {
    points,
    progress: n,
    needed: 5,
    members: brights.map((p) => p.uid),
    sets: points > 0 ? 1 : 0,
    tierLabel,
    setMembers: brights.map((p) => p.uid),
  };
}

function evaluateFullMonth(
  rule: Extract<JokboRule, { kind: 'fullMonth' }>,
  profiles: ScoringProfile[],
  triggerUid?: string,
): JokboEvaluation {
  const byMonth = new Map<Month, string[]>();
  for (const p of profiles) {
    for (const m of p.months) {
      const list = byMonth.get(m) ?? [];
      list.push(p.uid);
      byMonth.set(m, list);
    }
  }
  let sets = 0;
  let best = 0;
  const members: string[] = [];
  for (const m of ALL_MONTHS) {
    const list = byMonth.get(m) ?? [];
    const s = Math.floor(list.length / rule.setSize);
    sets += s;
    if (s > 0) members.push(...list);
    best = Math.max(best, list.length % rule.setSize === 0 && list.length > 0 ? rule.setSize : list.length % rule.setSize);
  }
  const trigger = profiles.find((p) => p.uid === triggerUid);
  let setMembers: string[] = [];
  if (trigger) {
    for (const m of trigger.months) {
      const list = byMonth.get(m) ?? [];
      if (list.length >= rule.setSize) {
        setMembers = list.slice(-rule.setSize);
        break;
      }
    }
  }
  if (!setMembers.length) setMembers = members.slice(-rule.setSize);
  return {
    points: sets * rule.pointsPerSet,
    progress: Math.min(best, rule.setSize),
    needed: rule.setSize,
    members: Array.from(new Set(members)),
    sets,
    setMembers,
  };
}

export function evaluateJokbo(
  def: JokboDefinition,
  profiles: ScoringProfile[],
  rules: JokboEvalRules,
  triggerUid?: string,
): JokboEvaluation {
  const rule = def.rule;
  switch (rule.kind) {
    case 'set':
      return evaluateSet(def.id, rule, profiles, triggerUid);
    case 'count':
      return evaluateCount(rule, profiles);
    case 'gwang':
      return evaluateGwang(rule, profiles, rules);
    case 'fullMonth':
      return evaluateFullMonth(rule, profiles, triggerUid);
  }
}

export function evaluateAllJokbo(
  profiles: ScoringProfile[],
  rules: JokboEvalRules,
  triggerUid?: string,
): Record<JokboId, JokboEvaluation> {
  const out = {} as Record<JokboId, JokboEvaluation>;
  for (const id of ALL_JOKBO) out[id] = evaluateJokbo(JOKBO_DEFS[id], profiles, rules, triggerUid);
  return out;
}
