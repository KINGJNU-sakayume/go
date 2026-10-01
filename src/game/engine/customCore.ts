import type { GameEvent, GameEventPayload, Weather } from '../types';
import { ensureTemp, invalidate, type GameContext } from '../effects/context';
import { JOKBO_DEFS } from '../jokbo/definitions';

type CustomEvent = Extract<GameEvent, { type: 'CUSTOM' }>;

/** State changes for CUSTOM events (the effect produced the event, the core applies it). */
export const CUSTOM_CORE: Record<string, (ctx: GameContext, ev: CustomEvent) => GameEventPayload[]> = {
  assignImpostor(ctx, ev) {
    if (!ctx.stage || !ev.cardUid || !ev.jokboId || ev.value === undefined) return [];
    const def = JOKBO_DEFS[ev.jokboId];
    const label = def.rule.kind === 'set' ? def.rule.slots[ev.value]?.label ?? def.name : def.name;
    ensureTemp(ctx.stage, ev.cardUid).impostor = { jokboId: ev.jokboId, slotIndex: ev.value, label };
    return [];
  },
  frost(ctx, ev) {
    if (!ctx.stage || !ev.cardUid) return [];
    const t = ensureTemp(ctx.stage, ev.cardUid);
    t.powerMult *= ctx.stageDef?.mechanics.firstUnmatchedPowerMult ?? 0.5;
    return [];
  },
  cover(ctx, ev) {
    if (!ctx.stage || !ev.cardUid) return [];
    if (ctx.stage.field.includes(ev.cardUid) && !ctx.stage.covered.includes(ev.cardUid)) ctx.stage.covered.push(ev.cardUid);
    return [];
  },
  shuffleField(ctx) {
    if (!ctx.stage) return [];
    ctx.stage.field = ctx.rng.shuffle(ctx.stage.field);
    return [];
  },
  setWeather(ctx, ev) {
    if (!ctx.stage || !ev.text) return [];
    ctx.stage.weather = ev.text as Weather;
    invalidate(ctx, 'all');
    return [];
  },
};
