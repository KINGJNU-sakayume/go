import type { CardInstance, JokboId, PendingOperation, RunState } from '../types';
import { BALANCE } from '../config/balance';
import { getCardDef } from '../cards/definitions';
import { JOKBO_DEFS } from '../jokbo/definitions';
import { evolutionsFor } from '../jokbo/evolutions';

export function pushOp(run: RunState, op: Omit<PendingOperation, 'id'>): PendingOperation {
  const full: PendingOperation = { ...op, id: run.nextOpId++ };
  run.ops.push(full);
  return full;
}

/** Permanent card level thresholds queue player choices (resolved outside of stages). */
export function onCardLevelChange(run: RunState, card: CardInstance, from: number, to: number): void {
  const name = getCardDef(card.defId).nameKo;
  for (const lv of BALANCE.cardEnhancementLevels) {
    if (from < lv && to >= lv) {
      pushOp(run, {
        kind: 'levelEnhancement',
        title: `${name} Lv.${lv} 달성`,
        description: '이 카드에 붙일 강화를 하나 고르세요.',
        source: 'levelUp',
        count: 1,
        cardUid: card.uid,
        cancellable: false,
        then: [],
      });
    }
  }
  for (const lv of BALANCE.cardSpecialLevels) {
    if (from < lv && to >= lv) {
      pushOp(run, {
        kind: 'specialUpgrade',
        title: `${name} Lv.${lv} 특별 강화`,
        description: '강화 또는 변이 중 하나를 고르세요.',
        source: 'levelUp',
        count: 1,
        cardUid: card.uid,
        cancellable: false,
        then: [],
      });
    }
  }
}

export function onJokboLevelChange(run: RunState, jokboId: JokboId, from: number, to: number): void {
  const owned = new Set(run.jokbo[jokboId].evolutions);
  const available = evolutionsFor(jokboId).filter((e) => !owned.has(e.id));
  for (const lv of BALANCE.evolutionLevels) {
    if (from < lv && to >= lv && available.length) {
      pushOp(run, {
        kind: 'chooseEvolution',
        title: `${JOKBO_DEFS[jokboId].name} Lv.${lv}: 진화`,
        description: '족보의 특수 진화를 하나 고르세요.',
        source: 'levelUp',
        count: 0,
        jokboId,
        cancellable: false,
        then: [],
      });
    }
  }
}
