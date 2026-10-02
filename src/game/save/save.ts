import type { RunState } from '../types';
import { SAVE_VERSION } from '../engine/run';
import { isSafePoint } from '../engine/stage';

export const SAVE_KEY = 'hwatu-roguelike/save';

export interface SaveFile {
  version: number;
  savedAt: number;
  run: RunState;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage (tests, private windows where localStorage throws). */
export class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

export function defaultStorage(): StorageLike {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__hwatu_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    // fall through
  }
  return new MemoryStorage();
}

type Migration = (file: SaveFile) => SaveFile;

/** version → migration to version+1. Add entries here when RunState changes shape. */
const MIGRATIONS: Record<number, Migration> = {
  // v2: 뻑 / 흔들기 / 피 뺏기 (new rule switches and stage state)
  1: (file) => {
    const run = file.run;
    run.rules = { ...run.rules, ppeok: run.rules.ppeok ?? true, shake: run.rules.shake ?? true, piSteal: run.rules.piSteal ?? true };
    const stage = run.stage;
    if (stage) {
      stage.ppeokPiles ??= [];
      stage.ppeokCount ??= 0;
      stage.bonusPi ??= 0;
      stage.shakeCount ??= 0;
    }
    run.version = 2;
    return { ...file, version: 2, run };
  },
  // v3: balance patch — 비띠 counts as 띠, identity operations roll unless `exact`
  2: (file) => {
    const run = file.run;
    run.rules = { ...run.rules, rainRibbonCountsAsRibbon: true };
    // operations already paid for under the old rules let the player pick: keep that promise
    const picked = ['monthShift', 'splitMoon', 'typeGraft', 'ribbonDye', 'upgradeJokbo'];
    for (const op of run.ops ?? []) {
      if (picked.includes(op.kind) || (op.kind === 'enhanceCard' && op.enhancement === 'dualMonth')) op.exact = true;
    }
    run.version = 3;
    return { ...file, version: 3, run };
  },
};

export function migrate(file: SaveFile): SaveFile {
  let current = file;
  while (current.version < SAVE_VERSION) {
    const step = MIGRATIONS[current.version];
    if (!step) throw new Error(`No migration from save version ${current.version}`);
    current = step(current);
  }
  return current;
}

export function serializeRun(run: RunState, now = Date.now()): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt: now, run };
  return JSON.stringify(file);
}

export function deserializeRun(json: string): RunState | null {
  try {
    const parsed = JSON.parse(json) as SaveFile;
    if (!parsed || typeof parsed.version !== 'number' || !parsed.run) return null;
    if (parsed.version > SAVE_VERSION) return null;
    return migrate(parsed).run;
  } catch {
    return null;
  }
}

/** Saves only at safe points (never in the middle of an unresolved turn). Returns true if written. */
export function saveRun(run: RunState, storage: StorageLike = defaultStorage(), now = Date.now()): boolean {
  if (!isSafePoint(run)) return false;
  try {
    storage.setItem(SAVE_KEY, serializeRun(run, now));
    return true;
  } catch {
    return false;
  }
}

export function loadRun(storage: StorageLike = defaultStorage()): RunState | null {
  const raw = storage.getItem(SAVE_KEY);
  return raw ? deserializeRun(raw) : null;
}

export function readSaveMeta(storage: StorageLike = defaultStorage()): { savedAt: number; seed: string; stageIndex: number; phase: string } | null {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SaveFile;
    return { savedAt: parsed.savedAt, seed: parsed.run.seed, stageIndex: parsed.run.stageIndex, phase: parsed.run.phase };
  } catch {
    return null;
  }
}

export function deleteSave(storage: StorageLike = defaultStorage()): void {
  storage.removeItem(SAVE_KEY);
}
