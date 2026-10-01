import type { GameEventPayload } from '../types';
import type { EvalScope } from './evaluate';

/**
 * Registry for the few effects that need bespoke logic. Definitions reference them by id
 * (`{ kind: 'custom', id }`), so data stays declarative while the engine stays generic.
 */
export type CustomCondition = (scope: EvalScope) => boolean;
export type CustomEffect = (scope: EvalScope) => GameEventPayload[];

export const CUSTOM_CONDITIONS: Record<string, CustomCondition> = {};
export const CUSTOM_EFFECTS: Record<string, CustomEffect> = {};

export function registerCustomCondition(id: string, fn: CustomCondition): void {
  CUSTOM_CONDITIONS[id] = fn;
}

export function registerCustomEffect(id: string, fn: CustomEffect): void {
  CUSTOM_EFFECTS[id] = fn;
}
