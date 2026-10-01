import type { RunState } from '../types';
import { getCardDef } from '../cards/definitions';
import { opCandidates, opChoices, opNeedsCard, opNeedsChoice, resolveOperation } from '../engine/operations';
import { advanceToNextStage, chooseCrossroads, continueAfterStage, pickReward } from '../engine/run';
import { buyOffer, currentPrice } from '../shop/shop';
import { chooseEventOption } from '../events/encounters';
import { botPlayStage } from './bot';

function junkScore(run: RunState, uid: string): number {
  const c = run.deck.find((x) => x.uid === uid)!;
  const def = getCardDef(c.defId);
  let s = c.level * 10 + c.enhancements.length * 20;
  if (def.category === 'pi') s += def.doublePi ? 8 : 0;
  else if (def.category === 'joker') s += 30;
  else s += 20;
  return s;
}

function resolveOps(run: RunState): RunState {
  let cur = run;
  let guard = 0;
  while (cur.ops.length && guard++ < 50) {
    const op = cur.ops[0];
    const cands = opNeedsCard(op) ? opCandidates(cur, op) : [];
    if (opNeedsCard(op) && cands.length < Math.max(1, op.count)) {
      cur = op.cancellable ? resolveOperation(cur, op.id, { cancel: true }) : { ...cur, ops: cur.ops.slice(1) };
      continue;
    }
    const sorted = [...cands].sort((a, b) => (op.kind === 'removeCard' ? junkScore(cur, a) - junkScore(cur, b) : junkScore(cur, b) - junkScore(cur, a)));
    const cardUids = opNeedsCard(op) ? sorted.slice(0, Math.max(1, op.count)) : undefined;
    const choices = opNeedsChoice(op) ? opChoices(cur, op, cardUids?.[0]) : [];
    try {
      cur = resolveOperation(cur, op.id, { cardUids, choiceId: choices[0]?.id, jokboId: op.kind === 'upgradeJokbo' ? 'pi' : undefined });
    } catch {
      cur = { ...cur, ops: cur.ops.slice(1) };
    }
  }
  return cur;
}

export interface RunSimResult {
  reached: number;
  victory: boolean;
  scores: number[];
  deckSize: number;
}

export function botPlayRun(run: RunState): RunSimResult {
  let cur = run;
  let guard = 0;
  while (guard++ < 400) {
    if (cur.phase === 'stage') cur = botPlayStage(cur, { go: false });
    else if (cur.phase === 'stageResult') cur = continueAfterStage(cur);
    else if (cur.phase === 'reward') {
      const opts = cur.reward!.options;
      const pick = opts.find((o) => o.kind === 'upgradeJokbo') ?? opts.find((o) => o.kind === 'talisman') ?? opts[0];
      cur = resolveOps(pickReward(cur, pick.id));
    } else if (cur.phase === 'crossroads') {
      cur = chooseCrossroads(cur, cur.stageIndex % 2 === 0 ? 'shop' : cur.crossroads!.options[1].id);
    } else if (cur.phase === 'shop') {
      for (let k = 0; k < 6; k++) {
        const offers = cur.shop!.offers.filter((o) => !o.sold && currentPrice(cur, o) <= cur.coins);
        const o = offers.find((x) => x.service === 'talisman') ?? offers.find((x) => x.service === 'jokboTraining') ?? offers.find((x) => x.service === 'removal');
        if (!o) break;
        try {
          cur = resolveOps(buyOffer(cur, o.id).run);
        } catch {
          break;
        }
      }
      cur = advanceToNextStage(resolveOps(cur));
    } else if (cur.phase === 'event') {
      const ch = cur.event!.choices.find((c) => !c.disabled && !c.reveals && (c.cost ?? 0) <= cur.coins);
      if (ch && !cur.event!.resolved) cur = resolveOps(chooseEventOption(cur, ch.id));
      cur = advanceToNextStage(resolveOps(cur));
    } else break;
  }
  return {
    reached: cur.stageIndex + (cur.phase === 'victory' ? 1 : 0),
    victory: cur.phase === 'victory',
    scores: cur.stats.stageScores,
    deckSize: cur.deck.length,
  };
}
