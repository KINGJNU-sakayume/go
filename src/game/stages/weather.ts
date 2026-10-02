import type { StageModifierDefinition, Weather } from '../types';

export const WEATHER_INFO: Record<Weather, { name: string; nameEn: string; glyph: string; description: string }> = {
  rain: { name: '비', nameEn: 'Rain', glyph: '☔', description: '12월(비) 카드 파워 +40, 획득 점수 ×2.' },
  wind: { name: '바람', nameEn: 'Wind', glyph: '🌬', description: '이웃 달 범위 +1, 이웃 달 카드 파워 +30.' },
  frost: { name: '서리', nameEn: 'Frost', glyph: '❄', description: '각 턴 첫 재발동의 기본 점수 ×0.5.' },
  clear: { name: '맑음', nameEn: 'Clear', glyph: '☀', description: '광이 포함된 족보 ×1.5, 광 파워 +30.' },
};

/** December weather as effect modifiers. No weather disables an archetype. */
export const WEATHER_MODIFIERS: Record<Weather, StageModifierDefinition> = {
  rain: {
    id: 'weather-rain',
    name: '날씨: 비',
    description: WEATHER_INFO.rain.description,
    specs: [
      { trigger: 'CARD_POWER', conditions: [{ kind: 'subject', filter: { rain: true } }], effects: [{ kind: 'power', value: 40 }] },
      { trigger: 'SCORE_CAPTURE', conditions: [{ kind: 'subject', filter: { rain: true } }], effects: [{ kind: 'captureMult', value: 2 }] },
    ],
  },
  wind: {
    id: 'weather-wind',
    name: '날씨: 바람',
    description: WEATHER_INFO.wind.description,
    specs: [
      {
        trigger: 'CARD_POWER',
        conditions: [{ kind: 'subject', filter: { hasEnhancement: 'adjacentMonth' } }],
        effects: [{ kind: 'power', value: 30 }],
      },
    ],
  },
  frost: {
    id: 'weather-frost',
    name: '날씨: 서리',
    description: WEATHER_INFO.frost.description,
    specs: [
      {
        trigger: 'SCORE_JOKBO',
        conditions: [
          { kind: 'reason', reasons: ['retrigger'] },
          { kind: 'scalar', value: { scalar: 'counter', arg: 'turn:retriggers' }, op: '==', than: 1 },
        ],
        effects: [{ kind: 'baseMult', value: 0.5 }],
      },
    ],
  },
  clear: {
    id: 'weather-clear',
    name: '날씨: 맑음',
    description: WEATHER_INFO.clear.description,
    specs: [
      { trigger: 'SCORE_JOKBO', conditions: [{ kind: 'member', filter: { bright: true } }], effects: [{ kind: 'jokboMult', value: 1.5 }] },
      { trigger: 'CARD_POWER', conditions: [{ kind: 'subject', filter: { bright: true } }], effects: [{ kind: 'power', value: 30 }] },
    ],
  },
};

export const ALL_WEATHER: Weather[] = ['rain', 'wind', 'frost', 'clear'];
