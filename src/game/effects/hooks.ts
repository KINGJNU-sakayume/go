import type { CardView, PowerPart, RulesConfig, ScoreHook } from '../types';
import { BALANCE } from '../config/balance';
import type { CardIdentity } from '../cards/identity';
import { hasEnhancement } from '../cards/identity';
import { registerResolvers, tempOf, type GameContext } from './context';
import { conditionsPass, evalValue, type EvalScope, type ScoreScope } from './evaluate';
import { hasTalisman, specsFor } from './sources';

// ---------------------------------------------------------------- rules

export function computeRules(ctx: GameContext): RulesConfig {
  const rules: RulesConfig = { ...ctx.run.rules };
  for (const { source, spec } of specsFor(ctx, 'RULES')) {
    const scope: EvalScope = { ctx, source };
    if (!conditionsPass(spec.conditions, scope)) continue;
    for (const action of spec.effects) {
      if (action.kind !== 'rule') continue;
      const key = action.rule;
      const current = rules[key];
      const mode = action.mode ?? (typeof action.value === 'boolean' ? 'set' : 'set');
      if (typeof current === 'number' && typeof action.value === 'number') {
        if (mode === 'add') (rules[key] as number) = current + action.value;
        else if (mode === 'max') (rules[key] as number) = Math.max(current, action.value);
        else (rules[key] as number) = action.value;
      } else if (typeof current === 'boolean' && typeof action.value === 'boolean') {
        (rules[key] as boolean) = action.value;
      }
    }
  }
  return rules;
}

// ---------------------------------------------------------------- power

export function enhancementFactor(ctx: GameContext, identity: CardIdentity): number {
  return identity.joker && identity.jokerForm === 'empty' && hasTalisman(ctx, 'empty-mask') ? 3 : 1;
}

export function computePower(ctx: GameContext, identity: CardIdentity): Pick<CardView, 'power' | 'powerParts'> {
  const parts: PowerPart[] = [];
  const { def, card } = identity;
  const temp = tempOf(ctx, card.uid);
  const factor = enhancementFactor(ctx, identity);

  let sum = def.basePower;
  parts.push({ label: '기본', value: def.basePower });

  // collect hook modifiers
  let levelMult = identity.joker && identity.jokerForm === 'empty' ? 3 : 1;
  const adds: PowerPart[] = [];
  const mults: PowerPart[] = [];
  for (const { source, spec } of specsFor(ctx, 'CARD_POWER')) {
    const scope: EvalScope = { ctx, source, subjectUid: card.uid };
    if (!conditionsPass(spec.conditions, scope)) continue;
    for (const action of spec.effects) {
      if (action.kind === 'power') adds.push({ label: source.ref.label, value: Math.round(evalValue(action.value, scope)) });
      else if (action.kind === 'powerMult') mults.push({ label: source.ref.label, value: evalValue(action.value, scope) });
      else if (action.kind === 'levelPowerMult') levelMult *= evalValue(action.value, scope);
    }
  }

  const levelPower = Math.round(BALANCE.levelPower(identity.level) * levelMult);
  if (levelPower) {
    sum += levelPower;
    parts.push({ label: levelMult !== 1 ? `Lv.${identity.level} (×${levelMult})` : `Lv.${identity.level}`, value: levelPower });
  }
  const reinforced = identity.enhancements.filter((e) => e.id === 'reinforced').reduce((s, e) => s + e.stacks, 0);
  if (reinforced) {
    const v = reinforced * BALANCE.reinforcedPower * factor;
    sum += v;
    parts.push({ label: `강화 ×${reinforced}${factor > 1 ? ` (빈 가면 ×${factor})` : ''}`, value: v });
  }
  if (card.bonusPower) {
    sum += card.bonusPower;
    parts.push({ label: '성장 (영구)', value: card.bonusPower });
  }
  if (temp?.powerBonus) {
    sum += temp.powerBonus;
    parts.push({ label: '임시', value: temp.powerBonus });
  }
  if (hasEnhancement(identity.enhancements, 'cursed')) {
    const v = BALANCE.cursedPower * factor;
    sum += v;
    parts.push({ label: '저주', value: v });
  }
  for (const a of adds) {
    if (!a.value) continue;
    sum += a.value;
    parts.push(a);
  }

  let mult = 1;
  if (hasEnhancement(identity.enhancements, 'hollow')) {
    mult *= BALANCE.hollowPowerMult;
    parts.push({ label: `공허 ×${BALANCE.hollowPowerMult}`, value: 0 });
  }
  if (identity.mutations.some((m) => m.id === 'withered')) {
    mult *= BALANCE.witheredPowerMult;
    parts.push({ label: `시듦 ×${BALANCE.witheredPowerMult}`, value: 0 });
  }
  if (temp && temp.powerMult !== 1) {
    mult *= temp.powerMult;
    parts.push({ label: `임시 ×${temp.powerMult}`, value: 0 });
  }
  for (const m of mults) {
    mult *= m.value;
    parts.push({ label: `${m.label} ×${m.value}`, value: 0 });
  }
  return { power: Math.max(0, Math.round(sum * mult)), powerParts: parts };
}

// ---------------------------------------------------------------- score modifiers

export interface ModEntry {
  label: string;
  value: number;
}

export interface ScoreMods {
  baseMults: ModEntry[];
  flats: ModEntry[];
  jokboMults: ModEntry[];
  jokboAdds: ModEntry[];
  globalMults: ModEntry[];
  globalAdds: ModEntry[];
  captureMults: ModEntry[];
}

export function emptyMods(): ScoreMods {
  return { baseMults: [], flats: [], jokboMults: [], jokboAdds: [], globalMults: [], globalAdds: [], captureMults: [] };
}

export function collectScoreMods(ctx: GameContext, score: ScoreScope, hooks: ScoreHook[]): ScoreMods {
  const mods = emptyMods();
  for (const hook of hooks) {
    for (const { source, spec } of specsFor(ctx, hook)) {
      const scope: EvalScope = { ctx, source, score, subjectUid: score.subjectUid };
      if (!conditionsPass(spec.conditions, scope)) continue;
      const repeat = Math.max(1, source.repeat);
      for (let r = 0; r < repeat; r++) {
        for (const action of spec.effects) {
          const label = spec.shout ?? source.ref.label;
          switch (action.kind) {
            case 'baseMult':
              mods.baseMults.push({ label, value: evalValue(action.value, scope) });
              break;
            case 'flat':
              mods.flats.push({ label, value: evalValue(action.value, scope) });
              break;
            case 'jokboMult':
              mods.jokboMults.push({ label, value: evalValue(action.value, scope) });
              break;
            case 'jokboMultAdd':
              mods.jokboAdds.push({ label, value: evalValue(action.value, scope) });
              break;
            case 'globalMult':
              mods.globalMults.push({ label, value: evalValue(action.value, scope) });
              break;
            case 'globalMultAdd':
              mods.globalAdds.push({ label, value: evalValue(action.value, scope) });
              break;
            case 'captureMult':
              mods.captureMults.push({ label, value: evalValue(action.value, scope) });
              break;
            default:
              break;
          }
        }
      }
    }
  }
  return mods;
}

registerResolvers(computeRules, computePower);
