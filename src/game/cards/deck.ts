import type {
  CardInstance,
  CardOrigin,
  EnhancementInstance,
  JokerFormId,
  MutationInstance,
  RulesConfig,
} from '../types';
import { JOKER_DEFINITION, STANDARD_CARDS, getCardDef } from './definitions';

export function uidFor(n: number): string {
  return `c${n}`;
}

export interface MakeCardOptions {
  level?: number;
  enhancements?: EnhancementInstance[];
  mutations?: MutationInstance[];
  jokerForm?: JokerFormId;
  origin?: CardOrigin;
  bonusPower?: number;
  permanentTags?: string[];
  clonedFrom?: string;
}

export function makeCard(defId: string, uid: string, opts: MakeCardOptions = {}): CardInstance {
  const def = getCardDef(defId);
  return {
    uid,
    defId,
    level: opts.level ?? 1,
    enhancements: (opts.enhancements ?? []).map((e) => ({ ...e })),
    mutations: (opts.mutations ?? []).map((m) => ({ ...m, months: m.months ? [...m.months] : undefined })),
    bonusPower: opts.bonusPower ?? 0,
    jokerForm: def.category === 'joker' ? (opts.jokerForm ?? 'service') : undefined,
    permanentTags: [...(opts.permanentTags ?? [])],
    origin: opts.origin ?? 'starter',
    clonedFrom: opts.clonedFrom,
  };
}

/** 48 standard cards + configurable Service Jokers. Each physical card gets its own uid. */
export function createStartingDeck(rules: RulesConfig, firstUid = 1): { cards: CardInstance[]; nextUid: number } {
  let n = firstUid;
  const cards: CardInstance[] = [];
  for (const def of STANDARD_CARDS) cards.push(makeCard(def.id, uidFor(n++)));
  for (let i = 0; i < rules.jokerCount; i++) cards.push(makeCard(JOKER_DEFINITION.id, uidFor(n++)));
  return { cards, nextUid: n };
}

/** Clone the printed card only: same definition, Lv.1, no upgrades. */
export function cloneBase(card: CardInstance, newUid: string): CardInstance {
  return makeCard(card.defId, newUid, {
    origin: 'clone',
    clonedFrom: card.uid,
    jokerForm: card.jokerForm ? 'service' : undefined,
    permanentTags: ['duplicate'],
  });
}

/** Perfect Clone: exact copy including level, enhancements, mutations and joker form. */
export function clonePerfect(card: CardInstance, newUid: string): CardInstance {
  return {
    ...card,
    uid: newUid,
    enhancements: card.enhancements.map((e) => ({ ...e })),
    mutations: card.mutations.map((m) => ({ ...m, months: m.months ? [...m.months] : undefined })),
    permanentTags: Array.from(new Set([...card.permanentTags, 'duplicate'])),
    origin: 'perfectClone',
    clonedFrom: card.uid,
  };
}

export function deepCopyCard(card: CardInstance): CardInstance {
  return {
    ...card,
    enhancements: card.enhancements.map((e) => ({ ...e })),
    mutations: card.mutations.map((m) => ({ ...m, months: m.months ? [...m.months] : undefined })),
    permanentTags: [...card.permanentTags],
  };
}
