import type { CaptureOption, RunState } from '../types';
import { ALL_JOKBO } from '../types';
import { capturedProfiles, effectiveRules, identityOf, profileOf } from '../effects/context';
import { evaluateAllJokbo } from '../jokbo/evaluate';
import { canExchange, chooseExchange, chooseGo, chooseStop, chooseTarget, exchangeCard, handCaptureOptions, playCard, stageContext } from '../engine/stage';

/** Very simple greedy player used for smoke tests and balance simulation. */
function jokboValue(evals: ReturnType<typeof evaluateAllJokbo>): number {
  let v = 0;
  for (const id of ALL_JOKBO) {
    const e = evals[id];
    v += e.points * 100;
    // progress toward the next point, weighted by how close it is
    const frac = e.needed > 0 ? Math.min(1, e.progress / e.needed) : 0;
    v += frac * frac * (id === 'pi' ? 60 : id === 'animal' || id === 'ribbon' ? 70 : 120);
  }
  return v;
}

function optionValue(run: RunState, option: CaptureOption, playedUid?: string): number {
  const ctx = stageContext(run);
  if (option.kind === 'place') return 0;
  const rules = effectiveRules(ctx);
  const before = capturedProfiles(ctx);
  const gained = [...option.targetUids, ...(playedUid ? [playedUid] : [])].map((u) => profileOf(ctx, u));
  const evalRules = { rainBrightPenalty: rules.rainBrightPenalty };
  const delta = jokboValue(evaluateAllJokbo([...before, ...gained], evalRules)) - jokboValue(evaluateAllJokbo(before, evalRules));
  let v = delta;
  for (const u of option.targetUids) {
    const id = identityOf(ctx, u);
    v += id.bright ? 30 : id.animal || id.ribbon ? 18 : 9 * Math.max(1, id.piValue);
  }
  return v + 1;
}

export function botStep(run: RunState, opts: { go?: boolean } = {}): RunState {
  const stage = run.stage!;
  switch (stage.phase) {
    case 'goStop':
      return opts.go && stage.turn < stage.turnsTotal - 2 ? chooseGo(run) : chooseStop(run);
    case 'chooseHandTarget':
    case 'chooseStockTarget': {
      const options = stage.pending!.options;
      const played = stage.pending!.kind === 'hand' ? stage.pending!.cardUid : stage.pending!.cardUid;
      const best = [...options].sort((a, b) => optionValue(run, b, played) - optionValue(run, a, played))[0];
      return chooseTarget(run, best.id);
    }
    case 'chooseExchange':
      return chooseExchange(run, stage.pending!.candidates![0]);
    case 'play': {
      // exchange a card with no match once in a while
      let bestUid = stage.hand[0];
      let bestScore = -1;
      let bestOpt: CaptureOption | undefined;
      for (const uid of stage.hand) {
        for (const o of handCaptureOptions(run, uid)) {
          const s = optionValue(run, o, uid);
          if (s > bestScore) {
            bestScore = s;
            bestUid = uid;
            bestOpt = o;
          }
        }
      }
      if (bestScore <= 0 && stage.exchangesLeft > 0) {
        const ex = stage.hand.find((u) => canExchange(run, u).ok);
        if (ex) return exchangeCard(run, ex);
      }
      return playCard(run, bestUid, bestOpt && bestOpt.kind !== 'place' ? bestOpt.id : bestOpt?.id);
    }
    default:
      return run;
  }
}

export function botPlayStage(run: RunState, opts: { go?: boolean } = {}): RunState {
  let cur = run;
  let guard = 0;
  while (cur.phase === 'stage' && guard++ < 200) cur = botStep(cur, opts);
  if (guard >= 200) throw new Error('bot stuck');
  return cur;
}
