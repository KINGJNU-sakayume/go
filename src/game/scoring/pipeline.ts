import type { CardCategory, ScoreBreakdown, ScoreEntry } from '../types';
import { BALANCE } from '../config/balance';
import { JOKBO_DEFS } from '../jokbo/definitions';
import { effectiveRules, identityOf, viewOf, type GameContext } from '../effects/context';
import type { ScoreScope } from '../effects/evaluate';
import { collectScoreMods, type ModEntry, type ScoreMods } from '../effects/hooks';

/**
 * The scoring pipeline. Every score is
 *   (Base × BaseMult + CardPower + Flat) × JokboMult × GlobalMult
 * where every factor is a list of labelled modifier entries so the UI can explain it.
 */

function product(list: ModEntry[]): number {
  return list.reduce((p, e) => p * e.value, 1);
}

function sum(list: ModEntry[]): number {
  return list.reduce((s, e) => s + e.value, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 흔들기 / 폭탄 / 총통 stacks → score factor (capped at `shakeMaxStacks`). */
export function shakeFactor(stacks: number): number {
  return Math.pow(BALANCE.shakeMult, Math.max(0, Math.min(stacks, BALANCE.shakeMaxStacks)));
}

export function globalMultiplier(ctx: GameContext, mods: ScoreMods, entries: ScoreEntry[]): number {
  const stage = ctx.stage;
  let add = 0;
  const perm = ctx.run.modifiers.permanentGlobalAdd;
  if (perm) {
    add += perm;
    entries.push({ source: '영구 보너스', kind: 'globalMultAdd', value: round2(perm) });
  }
  if (stage?.globalMultAdd) {
    add += stage.globalMultAdd;
    entries.push({ source: '이번 스테이지', kind: 'globalMultAdd', value: round2(stage.globalMultAdd) });
  }
  for (const e of mods.globalAdds) {
    if (!e.value) continue;
    add += e.value;
    entries.push({ source: e.label, kind: 'globalMultAdd', value: round2(e.value) });
  }
  const go = stage?.goCount ?? 0;
  if (go > 0 && BALANCE.goMultAdd) {
    add += go * BALANCE.goMultAdd;
    entries.push({ source: `${go}고`, kind: 'globalMultAdd', value: round2(go * BALANCE.goMultAdd) });
  }
  let mult = 1 + add;
  const shake = shakeFactor(stage?.shakeCount ?? 0);
  if (shake !== 1) {
    mult *= shake;
    entries.push({ source: `흔들기 ${Math.min(stage!.shakeCount, BALANCE.shakeMaxStacks)}회`, kind: 'globalMult', value: round2(shake) });
  }
  if (stage && stage.globalMultFactor !== 1) {
    mult *= stage.globalMultFactor;
    entries.push({ source: '스테이지 배율', kind: 'globalMult', value: round2(stage.globalMultFactor) });
  }
  for (const e of mods.globalMults) {
    if (e.value === 1) continue;
    mult *= e.value;
    entries.push({ source: e.label, kind: 'globalMult', value: round2(e.value) });
  }
  return Math.max(0, mult);
}

export function computeJokboScore(ctx: GameContext, scope: ScoreScope): ScoreBreakdown {
  const rules = effectiveRules(ctx);
  const jokboId = scope.jokboId!;
  const progress = ctx.run.jokbo[jokboId];
  const ledger = ctx.stage?.ledger[jokboId];
  const mods = collectScoreMods(ctx, scope, ['SCORE_JOKBO', 'SCORE_ALL']);
  const entries: ScoreEntry[] = [];

  const base = (scope.tradPoints ?? 0) * rules.pointValue;
  entries.push({ source: `${JOKBO_DEFS[jokboId].name} ${scope.tradPoints ?? 0}점`, kind: 'base', value: base });
  let baseMult = product(mods.baseMults);
  for (const e of mods.baseMults) entries.push({ source: e.label, kind: 'baseMult', value: round2(e.value) });

  // June boss: each retrigger weakens the next one.
  const decay = ctx.stageDef?.mechanics.retriggerDecay;
  if (scope.reason === 'retrigger' && decay && ctx.stage) {
    const n = Math.max(0, ctx.stage.retriggersThisStage - 1);
    const f = Math.max(0.4, 1 - decay * n);
    if (f !== 1) {
      baseMult *= f;
      entries.push({ source: '나비 폭풍 (재발동 감쇠)', kind: 'baseMult', value: round2(f) });
    }
  }

  let power = 0;
  for (const uid of scope.contributorUids) power += viewOf(ctx, uid).power;
  if (power) entries.push({ source: '카드 파워', kind: 'power', value: power });

  let flat = sum(mods.flats);
  for (const e of mods.flats) if (e.value) entries.push({ source: e.label, kind: 'flat', value: Math.round(e.value) });
  if (progress?.bonusFlat) {
    flat += progress.bonusFlat;
    entries.push({ source: '족보 수련', kind: 'flat', value: progress.bonusFlat });
  }
  if (ctx.run.modifiers.permanentJokboFlat) {
    flat += ctx.run.modifiers.permanentJokboFlat;
    entries.push({ source: '영구 족보 보너스', kind: 'flat', value: ctx.run.modifiers.permanentJokboFlat });
  }

  const level = progress?.level ?? 1;
  const levelMult = BALANCE.jokboLevelMult(level);
  entries.push({ source: `${JOKBO_DEFS[jokboId].name} Lv.${level}`, kind: 'jokboMult', value: levelMult });
  let addTotal = (progress?.bonusMultAdd ?? 0) + (ledger?.stageMultAdd ?? 0);
  if (progress?.bonusMultAdd) entries.push({ source: '족보 보너스', kind: 'jokboMultAdd', value: round2(progress.bonusMultAdd) });
  if (ledger?.stageMultAdd) entries.push({ source: '이번 스테이지 성장', kind: 'jokboMultAdd', value: round2(ledger.stageMultAdd) });
  for (const e of mods.jokboAdds) {
    if (!e.value) continue;
    addTotal += e.value;
    entries.push({ source: e.label, kind: 'jokboMultAdd', value: round2(e.value) });
  }
  let jokboMult = levelMult * (1 + addTotal);
  for (const e of mods.jokboMults) {
    if (e.value === 1) continue;
    jokboMult *= e.value;
    entries.push({ source: e.label, kind: 'jokboMult', value: round2(e.value) });
  }

  const globalMult = globalMultiplier(ctx, mods, entries);
  const raw = (base * baseMult + power + flat) * jokboMult * globalMult;
  return {
    base: Math.round(base * baseMult),
    power,
    flat: Math.round(flat),
    jokboMult: round2(jokboMult),
    globalMult: round2(globalMult),
    total: Math.max(0, Math.round(raw)),
    entries,
  };
}

export function captureBaseFor(categories: CardCategory[], piValue: number): number {
  let best = 0;
  for (const c of categories) {
    const v = c === 'pi' ? BALANCE.captureBase.pi * Math.max(1, piValue) : BALANCE.captureBase[c];
    best = Math.max(best, v);
  }
  return best;
}

export function computeCaptureScore(ctx: GameContext, scope: ScoreScope): ScoreBreakdown {
  const uid = scope.subjectUid!;
  const view = viewOf(ctx, uid);
  const mods = collectScoreMods(ctx, scope, ['SCORE_CAPTURE', 'SCORE_ALL']);
  const entries: ScoreEntry[] = [];
  const base = captureBaseFor(view.categories, view.piValue);
  entries.push({ source: `${view.name} 획득`, kind: 'base', value: base });
  const power = view.power;
  if (power) entries.push({ source: '카드 파워', kind: 'power', value: power });
  let flat = 0;
  for (const e of mods.flats) {
    if (!e.value) continue;
    flat += e.value;
    entries.push({ source: e.label, kind: 'flat', value: Math.round(e.value) });
  }
  let mult = 1;
  const stage = ctx.stage;
  if (stage) {
    let monthBest = 1;
    for (const m of identityOf(ctx, uid).scoringMonths) monthBest = Math.max(monthBest, stage.monthMult[m] ?? 1);
    if (monthBest !== 1) {
      mult *= monthBest;
      entries.push({ source: '달 배율', kind: 'captureMult', value: round2(monthBest) });
    }
  }
  if (view.mutations.some((m) => m.id === 'withered')) {
    mult *= BALANCE.witheredCaptureMult;
    entries.push({ source: '시듦', kind: 'captureMult', value: BALANCE.witheredCaptureMult });
  }
  for (const e of [...mods.captureMults, ...mods.jokboMults]) {
    if (e.value === 1) continue;
    mult *= e.value;
    entries.push({ source: e.label, kind: 'captureMult', value: round2(e.value) });
  }
  for (const e of mods.jokboAdds) {
    if (!e.value) continue;
    mult *= 1 + e.value;
    entries.push({ source: e.label, kind: 'captureMult', value: round2(1 + e.value) });
  }
  const globalMult = globalMultiplier(ctx, mods, entries);
  const raw = (base + power + flat) * mult * globalMult;
  return {
    base,
    power,
    flat: Math.round(flat),
    jokboMult: round2(mult),
    globalMult: round2(globalMult),
    total: Math.max(0, Math.round(raw)),
    entries,
  };
}

export function computeBonusScore(ctx: GameContext, scope: ScoreScope): ScoreBreakdown {
  const mods = collectScoreMods(ctx, scope, ['SCORE_BONUS', 'SCORE_ALL']);
  const entries: ScoreEntry[] = [];
  const base = scope.baseValue ?? 0;
  entries.push({ source: scope.label, kind: 'base', value: base });
  let flat = 0;
  for (const e of mods.flats) {
    if (!e.value) continue;
    flat += e.value;
    entries.push({ source: e.label, kind: 'flat', value: Math.round(e.value) });
  }
  let mult = 1;
  for (const e of [...mods.captureMults, ...mods.jokboMults]) {
    if (e.value === 1) continue;
    mult *= e.value;
    entries.push({ source: e.label, kind: 'captureMult', value: round2(e.value) });
  }
  const globalMult = scope.applyGlobal ? globalMultiplier(ctx, mods, entries) : 1;
  const raw = (base + flat) * mult * globalMult;
  return {
    base,
    power: 0,
    flat: Math.round(flat),
    jokboMult: round2(mult),
    globalMult: round2(globalMult),
    total: Math.round(raw),
    entries,
  };
}
