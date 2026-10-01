import type { GameEventPayload, RunState } from '../types';
import { deriveRng } from '../rng/rng';
import { makeContext, type GameContext } from '../effects/context';
import { conditionsPass, type EvalScope } from '../effects/evaluate';
import { runReaction } from '../effects/interpret';
import { specsFor } from '../effects/sources';
import { registerCustomEffect } from '../effects/customRegistry';
import { allTalismans } from '../talismans/registry';
import { onCardLevelChange } from './levelups';

/**
 * Run-level events (outside stages): CARD_REMOVED, CARD_DUPLICATED, ITEM_PURCHASED.
 * Talisman reactions run through the same DSL; only run-safe results are applied.
 */
export function emitRunEvent(run: RunState, payload: GameEventPayload): string[] {
  const rng = deriveRng(run.seed, 'runEvent', run.nextOpId, run.purchases, run.stats.cardsRemoved);
  const ctx: GameContext = makeContext(run, undefined, rng);
  const messages: string[] = [];
  const event = { ...payload, id: 0, chainId: -1, depth: 0, source: { kind: 'core', id: 'run', label: '런' } } as EvalScope['event'];
  for (const { source, spec } of specsFor(ctx, payload.type)) {
    const scope: EvalScope = { ctx, source, event };
    if (!conditionsPass(spec.conditions, scope)) continue;
    for (const out of runReaction(scope, spec)) messages.push(...applyRunPayload(run, out));
  }
  return messages;
}

function applyRunPayload(run: RunState, p: GameEventPayload): string[] {
  switch (p.type) {
    case 'COINS_GAINED':
      run.coins = Math.max(0, run.coins + p.amount);
      if (p.amount > 0) run.stats.coinsEarned += p.amount;
      return [`엽전 ${p.amount > 0 ? '+' : ''}${p.amount}`];
    case 'COUNTER_CHANGED': {
      if (p.scope !== 'talisman') return [];
      const [tid, name] = p.counter.split(':');
      const t = run.talismans.find((x) => x.id === tid);
      if (t && name) t.counters[name] = p.value;
      return [];
    }
    case 'CARD_UPGRADED': {
      const card = run.deck.find((c) => c.uid === p.cardUid);
      if (!card || p.scope !== 'run') return [];
      const from = card.level;
      card.level += p.levels;
      run.stats.cardsUpgraded++;
      onCardLevelChange(run, card, from, card.level);
      return [`카드 강화 Lv+${p.levels}`];
    }
    case 'CUSTOM': {
      if (p.id === 'gainTalisman' && p.text && !run.talismans.some((t) => t.id === p.text)) {
        run.talismans.push({ id: p.text, counters: {}, acquiredAt: run.stageIndex });
        run.stats.talismansObtained.push(p.text);
        return [`부적 획득: ${allTalismans().find((t) => t.id === p.text)?.name ?? p.text}`];
      }
      return [];
    }
    case 'MESSAGE':
      return [p.text];
    default:
      return [];
  }
}

registerCustomEffect('luckyPouch', (scope) => {
  const run = scope.ctx.run;
  if (run.purchases === 0 || run.purchases % 3 !== 0) return [];
  const roll = scope.ctx.rng.int(3);
  if (roll === 0) return [{ type: 'COINS_GAINED', amount: 5 }, { type: 'MESSAGE', text: '복주머니: 엽전 +5' }];
  if (roll === 1) {
    const pool = run.deck.filter((c) => c.defId !== 'joker');
    const pick = scope.ctx.rng.pickOrUndefined(pool);
    if (pick) return [{ type: 'CARD_UPGRADED', cardUid: pick.uid, levels: 1, scope: 'run' }, { type: 'MESSAGE', text: '복주머니: 무작위 카드 Lv+1' }];
  }
  const owned = new Set(run.talismans.map((t) => t.id));
  const commons = allTalismans().filter((t) => t.rarity === 'common' && !owned.has(t.id));
  const t = scope.ctx.rng.pickOrUndefined(commons);
  if (t) return [{ type: 'CUSTOM', id: 'gainTalisman', text: t.id }];
  return [{ type: 'COINS_GAINED', amount: 5 }];
});
