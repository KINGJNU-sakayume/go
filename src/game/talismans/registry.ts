import type { Rarity, TalismanDefinition } from '../types';
import { TALISMANS } from './definitions';

const INDEX = new Map(TALISMANS.map((t) => [t.id, t]));

export function getTalismanDef(id: string): TalismanDefinition | undefined {
  return INDEX.get(id);
}

export function allTalismans(): TalismanDefinition[] {
  return TALISMANS;
}

export function talismansOfRarity(rarity: Rarity): TalismanDefinition[] {
  return TALISMANS.filter((t) => t.rarity === rarity);
}

/** Test/debug hook: register an extra talisman definition at runtime. */
export function registerTalisman(def: TalismanDefinition): void {
  if (!INDEX.has(def.id)) TALISMANS.push(def);
  INDEX.set(def.id, def);
}
