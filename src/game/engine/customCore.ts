import type { GameEvent, GameEventPayload, Weather } from '../types';
import { ensureTemp, identityOf, invalidate, type GameContext } from '../effects/context';
import { isFrozen } from './match';
import { JOKBO_DEFS } from '../jokbo/definitions';
import { BALANCE } from '../config/balance';

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
    // frozen for this turn and the next: nothing can pair with it (not even the stock card → no 쪽)
    const turns = ctx.stageDef?.mechanics.frostTurns ?? 2;
    ensureTemp(ctx.stage, ev.cardUid).frozenUntil = ctx.stage.turn + turns - 1;
    return [];
  },
  cover(ctx, ev) {
    if (!ctx.stage || !ev.cardUid) return [];
    if (ctx.stage.field.includes(ev.cardUid) && !ctx.stage.covered.includes(ev.cardUid)) ctx.stage.covered.push(ev.cardUid);
    return [];
  },
  bridgeDrop(ctx) {
    const stage = ctx.stage;
    if (!stage) return [];
    const piled = new Set(stage.ppeokPiles.flatMap((p) => p.uids));
    const pool = stage.field.filter((u) => !piled.has(u) && !stage.covered.includes(u) && !isFrozen(ctx, u));
    const fall = ctx.rng.pickOrUndefined(pool);
    if (!fall) return [];
    const upIdx = stage.stock.findIndex((u) => !identityOf(ctx, u).joker);
    const at = stage.field.indexOf(fall);
    stage.field.splice(at, 1);
    stage.stock.push(fall);
    if (upIdx < 0) return [{ type: 'MESSAGE', text: `다리가 흔들려 ${identityOf(ctx, fall).name}이(가) 더미 밑으로 떨어졌다` }];
    const [up] = stage.stock.splice(upIdx, 1);
    stage.field.splice(at, 0, up);
    return [{ type: 'MESSAGE', text: `다리가 흔들려 ${identityOf(ctx, fall).name}이(가) 떨어지고 ${identityOf(ctx, up).name}이(가) 올라왔다` }];
  },
  ppeokBonus(ctx) {
    const stage = ctx.stage;
    if (!stage) return [];
    const boss = !!ctx.stageDef?.boss;
    const fraction = boss ? BALANCE.triplePpeokBossTargetFraction : BALANCE.triplePpeokTargetFraction;
    const amount = Math.round(stage.target * fraction);
    return amount > 0
      ? [{ type: 'SCORE_ADDED', amount, label: `삼뻑 보너스 (목표의 ${Math.round(fraction * 100)}%)`, scoreKind: 'special' }]
      : [];
  },
  setWeather(ctx, ev) {
    if (!ctx.stage || !ev.text) return [];
    ctx.stage.weather = ev.text as Weather;
    invalidate(ctx, 'all');
    return [];
  },
};
