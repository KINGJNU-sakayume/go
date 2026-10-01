import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultStorage,
  deleteSave,
  generateSeed,
  isRunOver,
  loadRun,
  newRun,
  normalizeSeed,
  readSaveMeta,
  saveRun,
  type RunState,
} from '../../game';

export type AnimSpeed = 'normal' | 'fast' | 'instant';

export interface Settings {
  animSpeed: AnimSpeed;
}

const SETTINGS_KEY = 'hwatu-roguelike/settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { animSpeed: 'normal', ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // storage unavailable
  }
  return { animSpeed: 'normal' };
}

export interface GameApi {
  run: RunState | null;
  error: string | null;
  toasts: { id: number; text: string }[];
  settings: Settings;
  saveMeta: ReturnType<typeof readSaveMeta>;
  setSettings: (s: Settings) => void;
  act: (fn: (run: RunState) => RunState) => boolean;
  toast: (text: string) => void;
  startNew: (seed?: string) => void;
  continueSave: () => void;
  deleteSaveFile: () => void;
  quitToTitle: () => void;
  replaceRun: (run: RunState) => void;
}

export function useGame(): GameApi {
  const storage = useMemo(() => defaultStorage(), []);
  const [run, setRun] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [saveMeta, setSaveMeta] = useState(() => readSaveMeta(storage));
  const toastId = useRef(1);
  const runRef = useRef<RunState | null>(null);
  runRef.current = run;

  const persist = useCallback(
    (next: RunState) => {
      if (isRunOver(next)) {
        deleteSave(storage);
        setSaveMeta(null);
      } else if (saveRun(next, storage)) {
        setSaveMeta(readSaveMeta(storage));
      }
    },
    [storage],
  );

  const toast = useCallback((text: string) => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-4), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const act = useCallback(
    (fn: (run: RunState) => RunState) => {
      const current = runRef.current;
      if (!current) return false;
      try {
        const next = fn(current);
        runRef.current = next;
        setRun(next);
        setError(null);
        persist(next);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast(msg);
        return false;
      }
    },
    [persist, toast],
  );

  const replaceRun = useCallback(
    (next: RunState) => {
      runRef.current = next;
      setRun(next);
      persist(next);
    },
    [persist],
  );

  const startNew = useCallback(
    (seed?: string) => {
      const s = seed ? normalizeSeed(seed) : generateSeed();
      replaceRun(newRun(s, {}, Date.now()));
    },
    [replaceRun],
  );

  const continueSave = useCallback(() => {
    const loaded = loadRun(storage);
    if (loaded) {
      runRef.current = loaded;
      setRun(loaded);
    } else toast('저장된 게임을 불러올 수 없습니다.');
  }, [storage, toast]);

  const deleteSaveFile = useCallback(() => {
    deleteSave(storage);
    setSaveMeta(null);
  }, [storage]);

  const quitToTitle = useCallback(() => {
    runRef.current = null;
    setRun(null);
    setSaveMeta(readSaveMeta(storage));
  }, [storage]);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(t);
  }, [error]);

  return { run, error, toasts, settings, saveMeta, setSettings, act, toast, startNew, continueSave, deleteSaveFile, quitToTitle, replaceRun };
}
