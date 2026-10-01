import type { GameEventPayload, JokboId, Month, Weather } from '../types';
import { ALL_JOKBO } from '../types';
import { registerCustomCondition, registerCustomEffect } from './customRegistry';
import { capturedProfiles, effectiveRules, identityOf } from './context';
import { scopeSubject, type EvalScope } from './evaluate';
import { RANDOM_TEMP_ENHANCEMENTS } from './interpret';
import { evaluateAllJokbo } from '../jokbo/evaluate';
import { JOKBO_DEFS } from '../jokbo/definitions';
import { ALL_WEATHER, WEATHER_INFO } from '../stages/weather';

function capturedMonthCount(scope: EvalScope, month: Month): number {
  const stage = scope.ctx.stage;
  if (!stage) return 0;
  return stage.captured.filter((u) => identityOf(scope.ctx, u).scoringMonths.includes(month)).length;
}

// ------------------------------------------------------------- conditions

registerCustomCondition('ownerInHand', (scope) => {
  const owner = scope.source.ownerUid;
  return !!owner && !!scope.ctx.stage?.hand.includes(owner);
});

registerCustomCondition('subjectSharesOwnerMonth', (scope) => {
  const owner = scope.source.ownerUid;
  const subject = scopeSubject(scope);
  if (!owner || !subject || owner === subject) return false;
  const om = identityOf(scope.ctx, owner).scoringMonths;
  return identityOf(scope.ctx, subject).scoringMonths.some((m) => om.includes(m));
});

registerCustomCondition('monthReachedThree', (scope) => {
  const subject = scopeSubject(scope);
  if (!subject) return false;
  return identityOf(scope.ctx, subject).scoringMonths.some((m) => capturedMonthCount(scope, m) === 3);
});

registerCustomCondition('consecutiveSameMonth', (scope) => {
  const ev = scope.event;
  const stage = scope.ctx.stage;
  if (!ev || ev.type !== 'CAPTURE_RESOLVED' || !stage) return false;
  const idx = stage.captureActions.findIndex((a) => a.id === ev.actionId);
  if (idx <= 0) return false;
  const cur = stage.captureActions[idx].months;
  const prev = stage.captureActions[idx - 1].months;
  return cur.some((m) => prev.includes(m));
});

registerCustomCondition('placedFromHand', (scope) => {
  const ev = scope.event;
  return !!ev && ev.type === 'CARD_PLACED' && ev.from === 'hand';
});

// ------------------------------------------------------------- effects

registerCustomEffect('fullMoonMonth', (scope) => {
  const subject = scopeSubject(scope);
  if (!subject) return [];
  const out: GameEventPayload[] = [];
  for (const m of identityOf(scope.ctx, subject).scoringMonths) {
    if (capturedMonthCount(scope, m) === 3) {
      out.push({ type: 'MULTIPLIER_CHANGED', scope: 'month', mode: 'mult', value: 1.5, month: m });
    }
  }
  return out;
});

registerCustomEffect('retriggerJokboOfSubject', (scope) => {
  const subject = scopeSubject(scope);
  const stage = scope.ctx.stage;
  if (!subject || !stage) return [];
  const out: GameEventPayload[] = [];
  for (const id of ALL_JOKBO) {
    const led = stage.ledger[id];
    if (led.points > 0 && led.lastTriggerCard === subject) out.push({ type: 'RETRIGGER_REQUESTED', jokboId: id });
  }
  return out;
});

registerCustomEffect('impostorAssign', (scope) => {
  const ctx = scope.ctx;
  const subject = scope.source.ownerUid ?? scopeSubject(scope);
  if (!ctx.stage || !subject) return [];
  const rules = effectiveRules(ctx);
  const profiles = capturedProfiles(ctx).filter((p) => p.uid !== subject);
  const evals = evaluateAllJokbo(profiles, { rainBrightPenalty: rules.rainBrightPenalty });
  let best: { id: JokboId; slot: number; score: number } | undefined;
  for (const id of ALL_JOKBO) {
    const def = JOKBO_DEFS[id];
    if (def.rule.kind !== 'set') continue;
    const e = evals[id];
    const slots = e.slots ?? [];
    const missing = slots.findIndex((f) => !f);
    if (missing < 0) continue;
    const filled = slots.filter(Boolean).length;
    const score = filled * 100 + def.rule.pointsPerSet;
    if (!best || score > best.score) best = { id, slot: missing, score };
  }
  if (!best) return [{ type: 'MESSAGE', text: '사기꾼 조커: 흉내 낼 빈칸이 없음' }];
  const def = JOKBO_DEFS[best.id];
  const label = def.rule.kind === 'set' ? def.rule.slots[best.slot].label : def.name;
  return [
    {
      type: 'CUSTOM',
      id: 'assignImpostor',
      cardUid: subject,
      jokboId: best.id,
      value: best.slot,
      text: `사기꾼 조커 → ${label} 행세`,
    },
  ];
});

registerCustomEffect('enhanceDrawn', (scope) => {
  const ev = scope.event;
  if (!ev || ev.type !== 'EXCHANGE_USED' || !ev.drawnUid) return [];
  return [
    {
      type: 'CARD_ENHANCED',
      cardUid: ev.drawnUid,
      enhancement: scope.ctx.rng.pick(RANDOM_TEMP_ENHANCEMENTS),
      scope: 'stage',
    },
  ];
});

registerCustomEffect('twinSwap', (scope) => {
  const ev = scope.event;
  const stage = scope.ctx.stage;
  if (!ev || ev.type !== 'EXCHANGE_USED' || !stage) return [];
  const out: GameEventPayload[] = [];
  let bonus = false;
  for (const m of identityOf(scope.ctx, ev.discardedUid).scoringMonths) {
    const key = `exch:${m}`;
    const next = (stage.counters[key] ?? 0) + 1;
    out.push({ type: 'COUNTER_CHANGED', counter: key, value: next, scope: 'stage' });
    if (next === 2) bonus = true;
  }
  if (bonus) out.push({ type: 'BONUS_SCORE', base: Math.max(50, Math.round(stage.target * 0.08)), label: '쌍교환', applyGlobal: true });
  return out;
});

registerCustomEffect('plumFrost', (scope) => {
  const ev = scope.event;
  if (!ev || ev.type !== 'CARD_PLACED') return [];
  return [{ type: 'CUSTOM', id: 'frost', cardUid: ev.cardUid, text: `${identityOf(scope.ctx, ev.cardUid).name}: 서리 (파워 ×0.5)` }];
});

registerCustomEffect('coverFieldCard', (scope) => {
  const stage = scope.ctx.stage;
  if (!stage) return [];
  const candidates = stage.field.filter((u) => !stage.covered.includes(u));
  const pick = scope.ctx.rng.pickOrUndefined(candidates);
  if (!pick) return [];
  return [{ type: 'CUSTOM', id: 'cover', cardUid: pick, text: '꽃잎 장막이 필드 카드 한 장을 가렸다' }];
});

registerCustomEffect('swayBridge', () => [{ type: 'CUSTOM', id: 'shuffleField', text: '다리가 흔들려 필드 자리가 바뀌었다' }]);

registerCustomEffect('changeWeather', (scope) => {
  const stage = scope.ctx.stage;
  const every = scope.ctx.stageDef?.mechanics.weatherEvery ?? 2;
  if (!stage || (stage.turn - 1) % every !== 0) return [];
  const options = ALL_WEATHER.filter((w) => w !== stage.weather);
  const next: Weather = scope.ctx.rng.pick(options);
  return [{ type: 'CUSTOM', id: 'setWeather', text: next, value: 0 }, { type: 'MESSAGE', text: `날씨 변화: ${WEATHER_INFO[next].glyph} ${WEATHER_INFO[next].name} — ${WEATHER_INFO[next].description}` }];
});

registerCustomEffect('boarCombo', (scope) => {
  const subject = scopeSubject(scope);
  const stage = scope.ctx.stage;
  if (!subject || !stage) return [];
  const id = identityOf(scope.ctx, subject);
  const month = id.printedMonth;
  if (!month) return [];
  const key = `turn:month:${month}`;
  const next = (stage.counters[key] ?? 0) + 1;
  const out: GameEventPayload[] = [{ type: 'COUNTER_CHANGED', counter: key, value: next, scope: 'stage' }];
  if (next >= 3) out.push({ type: 'BONUS_SCORE', base: 200 * (next - 2), label: `멧돼지 콤보 ${month}월 ×${next}`, applyGlobal: true });
  return out;
});

export const CUSTOM_EFFECTS_REGISTERED = true;
