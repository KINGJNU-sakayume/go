import type { EnhancementId, JokboId, Month } from './primitives';
import type { SourceRef } from './effects';
import type { RunModifierKey } from './run';

export type TriggerReason = 'complete' | 'increment' | 'retrigger';

export type CaptureFrom = 'hand' | 'stock' | 'service' | 'bomb' | 'effect';

export type SpecialCaptureKind = 'jjok' | 'ttadak' | 'sweep' | 'stack' | 'bomb' | 'chongtong';

export interface ScoreEntry {
  source: string;
  kind:
    | 'base'
    | 'power'
    | 'flat'
    | 'baseMult'
    | 'jokboMult'
    | 'jokboMultAdd'
    | 'globalMult'
    | 'globalMultAdd'
    | 'captureMult';
  value: number;
}

export interface ScoreBreakdown {
  base: number;
  power: number;
  flat: number;
  jokboMult: number;
  globalMult: number;
  total: number;
  entries: ScoreEntry[];
}

export type GameEventPayload =
  | { type: 'STAGE_STARTED' }
  | { type: 'TURN_STARTED'; turn: number }
  | { type: 'TURN_ENDED'; turn: number }
  | { type: 'CARD_DRAWN'; cardUid: string; reason: 'exchange' | 'refill' }
  | { type: 'CARD_PLAYED'; cardUid: string }
  | { type: 'STOCK_REVEALED'; cardUid: string }
  | { type: 'CARD_MATCHED'; cardUid: string; targetUids: string[]; from: 'hand' | 'stock' }
  | { type: 'CARD_PLACED'; cardUid: string; from: 'hand' | 'stock' }
  | {
      type: 'CARD_CAPTURED';
      cardUid: string;
      from: CaptureFrom;
      partnerUid?: string;
      actionId: number;
    }
  | { type: 'CAPTURE_SCORE'; cardUid: string; retrigger: boolean }
  | { type: 'JOKBO_CHECK'; triggerCardUid?: string }
  | {
      type: 'JOKBO_COMPLETED' | 'JOKBO_INCREMENTED';
      jokboId: JokboId;
      delta: number;
      points: number;
      triggerCardUid?: string;
      tierLabel?: string;
      contributorUids: string[];
      sets: number;
    }
  | {
      type: 'JOKBO_TRIGGERED';
      jokboId: JokboId;
      reason: TriggerReason;
      tradPoints: number;
      triggerCardUid?: string;
      contributorUids: string[];
      tierLabel?: string;
    }
  | { type: 'RETRIGGER_REQUESTED'; jokboId: JokboId }
  | {
      type: 'SCORE_ADDED';
      amount: number;
      label: string;
      scoreKind: 'capture' | 'jokbo' | 'bonus' | 'special';
      breakdown?: ScoreBreakdown;
      jokboId?: JokboId;
      cardUid?: string;
    }
  | { type: 'CAPTURE_RESOLVED'; cardUid: string; actionId: number }
  | { type: 'JOKER_REVEALED'; cardUid: string }
  | { type: 'CARD_UPGRADED'; cardUid: string; levels: number; scope: 'run' | 'stage' }
  | { type: 'CARD_ENHANCED'; cardUid: string; enhancement: EnhancementId; scope: 'run' | 'stage' }
  | { type: 'CARD_POWER_GAINED'; cardUid: string; amount: number; scope: 'run' | 'stage' }
  | { type: 'BONUS_SCORE'; base: number; label: string; applyGlobal: boolean; cardUid?: string; special?: SpecialCaptureKind }
  | { type: 'EXCHANGE_USED'; discardedUid: string; drawnUid?: string; free: boolean }
  | { type: 'EXCHANGE_GRANTED'; amount: number }
  | {
      type: 'MULTIPLIER_CHANGED';
      scope: 'global' | 'jokbo' | 'month';
      mode: 'add' | 'mult';
      value: number;
      jokboId?: JokboId;
      month?: Month;
    }
  | { type: 'PREVIEW_GRANTED'; count: number }
  | { type: 'COINS_GAINED'; amount: number }
  | { type: 'SPECIAL_CAPTURE'; special: SpecialCaptureKind; month?: Month; count?: number }
  | { type: 'FLAG_CHANGED'; flag: string; value: boolean }
  | { type: 'COUNTER_CHANGED'; counter: string; value: number; scope: 'stage' | 'talisman' }
  | { type: 'PROFILE_COPIED'; cardUid: string; fromUid: string }
  | { type: 'RUN_MODIFIER'; key: RunModifierKey; value: number; mode: 'add' | 'mult' }
  | { type: 'STAGE_ENDING' }
  | { type: 'STAGE_CLEARED' }
  | { type: 'CARD_REMOVED'; cardUid: string; defId: string }
  | { type: 'CARD_DUPLICATED'; cardUid: string; newUid: string }
  | { type: 'ITEM_PURCHASED'; service: string; price: number }
  | { type: 'MESSAGE'; text: string }
  | { type: 'CUSTOM'; id: string; text?: string; cardUid?: string; jokboId?: JokboId; value?: number };

export type GameEventType = GameEventPayload['type'];

export interface EventMeta {
  id: number;
  chainId: number;
  depth: number;
  parentId?: number;
  source: SourceRef;
  /** Structural events are never dropped by loop protection. */
  essential?: boolean;
  /** Shout shown right before this event (the effect that produced it). */
  announce?: string;
}

export type GameEvent = EventMeta & GameEventPayload;

export type ChainStepKind =
  | 'turn'
  | 'play'
  | 'reveal'
  | 'place'
  | 'capture'
  | 'special'
  | 'jokbo'
  | 'retrigger'
  | 'score'
  | 'effect'
  | 'mult'
  | 'upgrade'
  | 'exchange'
  | 'coins'
  | 'info'
  | 'overflow';

export type ChainTone = 'red' | 'blue' | 'green' | 'gold' | 'purple' | 'gray' | 'pink' | 'cyan';

export interface ChainStep {
  id: number;
  kind: ChainStepKind;
  depth: number;
  title: string;
  detail?: string;
  value?: number;
  source?: string;
  cardUid?: string;
  jokboId?: JokboId;
  tone?: ChainTone;
  breakdown?: ScoreBreakdown;
  /** Hype counter for the chain at this step (number of trigger events so far). */
  chainCount?: number;
}

export interface TriggerChain {
  id: number;
  title: string;
  turn: number;
  steps: ChainStep[];
  totalScore: number;
  /** Jokbo triggers + effect activations in this chain. */
  triggerCount: number;
  distinctSources: string[];
  /** Number of scoring events in this chain (for 끝없는 굿판). */
  scoreEvents: number;
  overflow: boolean;
  resolutions: number;
  open: boolean;
}
