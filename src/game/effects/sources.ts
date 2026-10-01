import type { EffectSpec, SourceRef, TriggerKind } from '../types';
import { ENHANCEMENTS } from '../cards/enhancements';
import { MUTATIONS } from '../cards/mutations';
import { JOKER_FORMS } from '../cards/jokers';
import { getEvolution } from '../jokbo/evolutions';
import { getTalismanDef } from '../talismans/registry';
import { STAGES } from '../stages/definitions';
import { WEATHER_MODIFIERS } from '../stages/weather';
import { getCardDef } from '../cards/definitions';
import type { GameContext } from './context';

/** One live provider of effect specs (a talisman, an enhanced card, an evolution, a stage rule…). */
export interface ActiveSource {
  key: string;
  ref: SourceRef;
  specs: EffectSpec[];
  ownerUid?: string;
  talismanId?: string;
  /** Effects fire this many times (Empty Joker + 빈 가면 triples its enhancement effects). */
  repeat: number;
}

export interface IndexedSpec {
  source: ActiveSource;
  spec: EffectSpec;
  specIndex: number;
}

export type SourceIndex = Map<TriggerKind, IndexedSpec[]>;

export function hasTalisman(ctx: GameContext, id: string): boolean {
  return ctx.run.talismans.some((t) => t.id === id);
}

export function talismanSpecs(id: string): EffectSpec[] {
  const def = getTalismanDef(id);
  if (!def) return [];
  const main: EffectSpec = {
    trigger: def.trigger,
    conditions: def.conditions,
    effects: def.effects,
    limit: def.limit,
    shout: def.shout,
  };
  return [main, ...(def.extraSpecs ?? [])];
}

export function collectSources(ctx: GameContext): ActiveSource[] {
  const out: ActiveSource[] = [];
  const emptyMask = hasTalisman(ctx, 'empty-mask');

  // 1. Cards: enhancements, mutations, joker forms (permanent + this stage's temporary ones)
  for (const card of ctx.run.deck) {
    const def = getCardDef(card.defId);
    const isEmptyJoker = def.category === 'joker' && card.jokerForm === 'empty';
    const repeat = isEmptyJoker && emptyMask ? 3 : 1;
    const temp = ctx.stage?.temp[card.uid];
    const enhancements = [...card.enhancements, ...(temp?.enhancements ?? [])];
    enhancements.forEach((e, i) => {
      const edef = ENHANCEMENTS[e.id];
      if (!edef.specs.length) return;
      out.push({
        key: `e:${e.id}:${card.uid}:${i}`,
        ref: { kind: 'enhancement', id: e.id, label: edef.name, cardUid: card.uid },
        specs: edef.specs,
        ownerUid: card.uid,
        repeat,
      });
    });
    for (const m of card.mutations) {
      const mdef = MUTATIONS[m.id];
      if (!mdef.specs.length) continue;
      out.push({
        key: `m:${m.id}:${card.uid}`,
        ref: { kind: 'mutation', id: m.id, label: mdef.name, cardUid: card.uid },
        specs: mdef.specs,
        ownerUid: card.uid,
        repeat: 1,
      });
    }
    if (def.category === 'joker' && card.jokerForm) {
      const jdef = JOKER_FORMS[card.jokerForm];
      if (jdef.specs.length) {
        out.push({
          key: `j:${card.jokerForm}:${card.uid}`,
          ref: { kind: 'joker', id: card.jokerForm, label: jdef.name, cardUid: card.uid },
          specs: jdef.specs,
          ownerUid: card.uid,
          repeat: 1,
        });
      }
    }
  }

  // 2. Jokbo evolutions
  for (const progress of Object.values(ctx.run.jokbo)) {
    for (const evoId of progress.evolutions) {
      const evo = getEvolution(evoId);
      if (!evo) continue;
      out.push({
        key: `v:${evoId}`,
        ref: { kind: 'evolution', id: evoId, label: evo.name, jokboId: evo.jokboId },
        specs: evo.specs,
        repeat: 1,
      });
    }
  }

  // 3. Talismans (accumulate without slots)
  for (const t of ctx.run.talismans) {
    const def = getTalismanDef(t.id);
    if (!def) continue;
    out.push({
      key: `t:${t.id}`,
      ref: { kind: 'talisman', id: t.id, label: def.name },
      specs: talismanSpecs(t.id),
      talismanId: t.id,
      repeat: 1,
    });
  }

  // 4. Stage rules and weather
  if (ctx.stage) {
    const stageDef = STAGES[ctx.stage.stageIndex];
    for (const mod of stageDef?.modifiers ?? []) {
      out.push({
        key: `s:${mod.id}`,
        ref: { kind: 'stage', id: mod.id, label: mod.name },
        specs: mod.specs,
        repeat: 1,
      });
    }
    if (ctx.stage.weather) {
      const w = WEATHER_MODIFIERS[ctx.stage.weather];
      out.push({
        key: `w:${w.id}`,
        ref: { kind: 'weather', id: w.id, label: w.name },
        specs: w.specs,
        repeat: 1,
      });
    }
  }
  return out;
}

export function sourceIndex(ctx: GameContext): SourceIndex {
  if (!ctx.cache.sourceIndex) {
    const index: SourceIndex = new Map();
    for (const source of collectSources(ctx)) {
      source.specs.forEach((spec, specIndex) => {
        const list = index.get(spec.trigger) ?? [];
        list.push({ source, spec, specIndex });
        index.set(spec.trigger, list);
      });
    }
    ctx.cache.sourceIndex = index;
  }
  return ctx.cache.sourceIndex;
}

export function specsFor(ctx: GameContext, trigger: TriggerKind): IndexedSpec[] {
  return sourceIndex(ctx).get(trigger) ?? [];
}
