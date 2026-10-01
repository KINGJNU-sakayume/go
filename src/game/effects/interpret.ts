import type {
  CardTarget,
  EffectAction,
  EffectSpec,
  EnhancementId,
  GameEventPayload,
  JokboId,
  RetriggerTarget,
} from '../types';
import { conditionsPass, evalValue, matchesFilter, scopeJokbo, scopeSubject, type EvalScope } from './evaluate';
import { CUSTOM_EFFECTS } from './customRegistry';
import { identityOf } from './context';
import { RIBBON_SET_IDS } from '../jokbo/definitions';

/** Enhancements that may be granted at random (no extra parameters needed). */
export const RANDOM_TEMP_ENHANCEMENTS: EnhancementId[] = [
  'reinforced',
  'golden',
  'echo',
  'bloom',
  'collector',
  'catalyst',
  'adjacentMonth',
  'wildMonth',
  'lucky',
];

function candidateUids(scope: EvalScope, target: CardTarget): string[] {
  const { ctx } = scope;
  const stage = ctx.stage;
  let pool: string[];
  switch (target.from) {
    case 'subject': {
      const s = scopeSubject(scope);
      pool = s ? [s] : [];
      break;
    }
    case 'owner':
      pool = scope.source.ownerUid ? [scope.source.ownerUid] : [];
      break;
    case 'captured':
      pool = stage ? [...stage.captured] : [];
      break;
    case 'hand':
      pool = stage ? [...stage.hand] : [];
      break;
    case 'field':
      pool = stage ? [...stage.field] : [];
      break;
    case 'deck':
      pool = ctx.run.deck.map((c) => c.uid);
      break;
  }
  if (target.filter) pool = pool.filter((u) => matchesFilter(scope, u, target.filter!));
  return pool;
}

export function resolveTargets(scope: EvalScope, target: CardTarget, count = 1): string[] {
  const pool = candidateUids(scope, target);
  if (!pool.length) return [];
  switch (target.pick) {
    case 'all':
      return pool;
    case 'random':
      return scope.ctx.rng.sample(pool, Math.max(1, count));
    case 'highestLevel':
    case 'lowestLevel': {
      const sorted = [...pool].sort((a, b) => {
        const la = identityOf(scope.ctx, a).level;
        const lb = identityOf(scope.ctx, b).level;
        return target.pick === 'highestLevel' ? lb - la : la - lb;
      });
      return sorted.slice(0, Math.max(1, count));
    }
  }
}

export function resolveRetriggerTargets(scope: EvalScope, target: RetriggerTarget): JokboId[] {
  const stage = scope.ctx.stage;
  if (!stage) return [];
  if (typeof target === 'object') return [target.jokbo];
  switch (target) {
    case 'event': {
      const j = scopeJokbo(scope);
      return j ? [j] : [];
    }
    case 'lastCompleted':
      return stage.lastCompletedJokbo ? [stage.lastCompletedJokbo] : [];
    case 'onlyScoredThisTurn': {
      const distinct = Array.from(new Set(stage.turnState.scoredJokbo));
      return distinct.length === 1 ? distinct : [];
    }
    case 'onlyRibbonSetThisStage': {
      const sets = stage.activatedRibbonSets.filter((j) => RIBBON_SET_IDS.includes(j));
      return sets.length === 1 ? sets : [];
    }
  }
}

function actionToEvents(action: EffectAction, scope: EvalScope, spec: EffectSpec): GameEventPayload[] {
  const { ctx } = scope;
  const subject = scopeSubject(scope);
  switch (action.kind) {
    case 'addScore': {
      const amount = Math.round(evalValue(action.value, scope));
      if (amount === 0) return [];
      return [
        {
          type: 'BONUS_SCORE',
          base: amount,
          label: action.label || spec.shout || scope.source.ref.label,
          applyGlobal: action.applyGlobal ?? true,
          cardUid: subject,
        },
      ];
    }
    case 'retrigger': {
      const ids = resolveRetriggerTargets(scope, action.target);
      const times = Math.max(1, Math.round(action.times ?? 1));
      const out: GameEventPayload[] = [];
      for (const jokboId of ids) for (let i = 0; i < times; i++) out.push({ type: 'RETRIGGER_REQUESTED', jokboId });
      return out;
    }
    case 'retriggerCapture':
      return subject ? [{ type: 'CAPTURE_SCORE', cardUid: subject, retrigger: true }] : [];
    case 'upgradeCard': {
      const count = action.count !== undefined ? Math.max(0, Math.round(evalValue(action.count, scope))) : 1;
      if (count <= 0) return [];
      return resolveTargets(scope, action.target, count).map((cardUid) => ({
        type: 'CARD_UPGRADED' as const,
        cardUid,
        levels: action.levels,
        scope: action.scope,
      }));
    }
    case 'tempEnhance': {
      const targets = resolveTargets(scope, action.target, 1);
      return targets.map((cardUid) => ({
        type: 'CARD_ENHANCED' as const,
        cardUid,
        enhancement:
          action.enhancement === 'random' ? ctx.rng.pick(RANDOM_TEMP_ENHANCEMENTS) : action.enhancement,
        scope: 'stage' as const,
      }));
    }
    case 'gainPower': {
      const amount = Math.round(evalValue(action.value, scope));
      if (!amount) return [];
      return resolveTargets(scope, action.target, 1).map((cardUid) => ({
        type: 'CARD_POWER_GAINED' as const,
        cardUid,
        amount,
        scope: action.scope,
      }));
    }
    case 'grantExchange': {
      const amount = Math.round(evalValue(action.value, scope));
      return amount ? [{ type: 'EXCHANGE_GRANTED', amount }] : [];
    }
    case 'stageGlobalMultAdd': {
      const value = evalValue(action.value, scope);
      return value ? [{ type: 'MULTIPLIER_CHANGED', scope: 'global', mode: 'add', value }] : [];
    }
    case 'stageGlobalMult':
      return [{ type: 'MULTIPLIER_CHANGED', scope: 'global', mode: 'mult', value: action.value }];
    case 'stageMonthMult': {
      const month = action.month === 'subject' ? (subject ? identityOf(ctx, subject).scoringMonths[0] : undefined) : action.month;
      return month ? [{ type: 'MULTIPLIER_CHANGED', scope: 'month', mode: 'mult', value: action.value, month }] : [];
    }
    case 'stageJokboMultAdd': {
      const jokboId = action.jokbo === 'event' ? scopeJokbo(scope) : action.jokbo;
      const value = evalValue(action.value, scope);
      return jokboId && value ? [{ type: 'MULTIPLIER_CHANGED', scope: 'jokbo', mode: 'add', value, jokboId }] : [];
    }
    case 'preview': {
      const count = Math.round(evalValue(action.value, scope));
      return count > 0 ? [{ type: 'PREVIEW_GRANTED', count }] : [];
    }
    case 'coins': {
      const amount = Math.round(evalValue(action.value, scope));
      return amount ? [{ type: 'COINS_GAINED', amount }] : [];
    }
    case 'setFlag':
      return [{ type: 'FLAG_CHANGED', flag: action.flag, value: action.value }];
    case 'counter': {
      const v = evalValue(action.value, scope);
      let current = 0;
      if (action.scope === 'stage') current = ctx.stage?.counters[action.counter] ?? 0;
      else current = ctx.run.talismans.find((t) => t.id === scope.source.talismanId)?.counters[action.counter] ?? 0;
      const value = action.op === 'add' ? current + v : v;
      return [
        {
          type: 'COUNTER_CHANGED',
          counter: action.scope === 'talisman' ? `${scope.source.talismanId}:${action.counter}` : action.counter,
          value,
          scope: action.scope,
        },
      ];
    }
    case 'nextStageExchange': {
      const value = Math.round(evalValue(action.value, scope));
      return value ? [{ type: 'RUN_MODIFIER', key: 'nextStageExchangeBonus', value, mode: 'add' }] : [];
    }
    case 'copyProfile': {
      const stage = ctx.stage;
      const target = scope.source.ownerUid ?? subject;
      if (!stage || !target) return [];
      let fromUid: string | undefined;
      if (action.from === 'partner') {
        const e = scope.event;
        fromUid = e?.type === 'CARD_CAPTURED' ? e.partnerUid : undefined;
        if (!fromUid) fromUid = [...stage.captured].reverse().find((u) => u !== target);
      } else if (action.from === 'lastCapturedNonJoker') {
        fromUid = stage.lastCapturedNonJoker;
      } else {
        let best: string | undefined;
        let bestLevel = -1;
        for (const u of stage.captured) {
          if (u === target) continue;
          const id = identityOf(ctx, u);
          if (id.joker) continue;
          if (id.level >= bestLevel) {
            best = u;
            bestLevel = id.level;
          }
        }
        fromUid = best;
      }
      return fromUid && fromUid !== target ? [{ type: 'PROFILE_COPIED', cardUid: target, fromUid }] : [];
    }
    case 'message':
      return [{ type: 'MESSAGE', text: action.text }];
    case 'custom': {
      const fn = CUSTOM_EFFECTS[action.id];
      return fn ? fn(scope) : [];
    }
    // scoring / passive actions are not reactions
    case 'jokboMult':
    case 'jokboMultAdd':
    case 'globalMult':
    case 'globalMultAdd':
    case 'flat':
    case 'baseMult':
    case 'captureMult':
    case 'power':
    case 'powerMult':
    case 'levelPowerMult':
    case 'rule':
    case 'priceMult':
      return [];
  }
}

/** Runs a reaction spec. Conditions must already have passed. */
export function runReaction(scope: EvalScope, spec: EffectSpec): GameEventPayload[] {
  const out: GameEventPayload[] = [];
  const repeat = Math.max(1, scope.source.repeat);
  for (let r = 0; r < repeat; r++) {
    for (const action of spec.effects) out.push(...actionToEvents(action, scope, spec));
  }
  return out;
}

export { conditionsPass };
