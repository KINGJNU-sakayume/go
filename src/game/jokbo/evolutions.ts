import type { CardFilter, EffectSpec, EvolutionDefinition, JokboId } from '../types';

interface ThemeNames {
  endless: [string, string];
  wave: [string, string];
  echo?: [string, string];
  deep: [string, string];
  /** Cards that feed Wave / Deep. */
  filter: CardFilter;
  filterKo: string;
}

const THEMES: Partial<Record<JokboId, ThemeNames>> = {
  cheongdan: {
    endless: ['끝없는 푸름', 'Endless Blue'],
    wave: ['청파', 'Blue Wave'],
    echo: ['푸른 메아리', 'Blue Echo'],
    deep: ['깊은 푸름', 'Deep Blue'],
    filter: { categories: ['ribbon'] },
    filterKo: '띠',
  },
  hongdan: {
    endless: ['끝없는 붉음', 'Endless Red'],
    wave: ['홍파', 'Red Wave'],
    echo: ['붉은 메아리', 'Red Echo'],
    deep: ['깊은 붉음', 'Deep Red'],
    filter: { categories: ['ribbon'] },
    filterKo: '띠',
  },
  chodan: {
    endless: ['끝없는 풀빛', 'Endless Green'],
    wave: ['풀물결', 'Grass Wave'],
    echo: ['풀빛 메아리', 'Green Echo'],
    deep: ['깊은 풀빛', 'Deep Green'],
    filter: { categories: ['ribbon'] },
    filterKo: '띠',
  },
  godori: {
    endless: ['끝없는 날갯짓', 'Endless Wings'],
    wave: ['새 물결', 'Flock Wave'],
    echo: ['새소리 메아리', 'Birdsong Echo'],
    deep: ['깊은 둥지', 'Deep Nest'],
    filter: { categories: ['animal'] },
    filterKo: '열끗',
  },
  animal: {
    endless: ['끝없는 무리', 'Endless Herd'],
    wave: ['짐승 물결', 'Beast Wave'],
    deep: ['깊은 숲', 'Deep Forest'],
    filter: { categories: ['animal'] },
    filterKo: '열끗',
  },
  ribbon: {
    endless: ['끝없는 띠', 'Endless Thread'],
    wave: ['띠 물결', 'Thread Wave'],
    deep: ['깊은 매듭', 'Deep Knot'],
    filter: { categories: ['ribbon'] },
    filterKo: '띠',
  },
  pi: {
    endless: ['끝없는 티끌', 'Endless Dust'],
    wave: ['피 물결', 'Pi Wave'],
    deep: ['깊은 늪', 'Deep Mire'],
    filter: { categories: ['pi'] },
    filterKo: '피',
  },
  fullMonth: {
    endless: ['끝없는 달', 'Endless Moon'],
    wave: ['달 물결', 'Moon Wave'],
    deep: ['깊은 달', 'Deep Moon'],
    filter: {},
    filterKo: '카드',
  },
};

const NAME_KO: Record<JokboId, string> = {
  gwang: '광',
  godori: '고도리',
  animal: '열끗',
  ribbon: '띠',
  hongdan: '홍단',
  cheongdan: '청단',
  chodan: '초단',
  pi: '피',
  fullMonth: '한 달 모음',
};

function endlessSpec(id: JokboId): EffectSpec {
  return {
    trigger: 'JOKBO_TRIGGERED',
    conditions: [
      { kind: 'jokbo', ids: [id] },
      { kind: 'reason', reasons: ['complete', 'increment'] },
    ],
    effects: [{ kind: 'retrigger', target: 'event', times: 1 }],
    limit: { perStage: 1 },
  };
}

function waveSpec(id: JokboId, filter: CardFilter, fraction: number): EffectSpec {
  return {
    trigger: 'CAPTURE_RESOLVED',
    conditions: [
      { kind: 'jokboActive', id },
      { kind: 'subject', filter },
    ],
    effects: [
      {
        kind: 'addScore',
        value: { scalar: 'jokboLastScore', arg: id, times: fraction },
        label: '물결',
        applyGlobal: false,
      },
    ],
  };
}

function echoSpec(id: JokboId): EffectSpec {
  return {
    trigger: 'JOKBO_TRIGGERED',
    conditions: [
      { kind: 'jokbo', ids: [id] },
      { kind: 'reason', reasons: ['complete', 'increment'] },
      { kind: 'allMembers', filter: { enhanced: true } },
    ],
    effects: [{ kind: 'retrigger', target: 'event', times: 1 }],
  };
}

function deepSpec(id: JokboId, filter: CardFilter, step: number): EffectSpec {
  return {
    trigger: 'CAPTURE_RESOLVED',
    conditions: [
      { kind: 'jokboActive', id },
      { kind: 'subject', filter },
    ],
    effects: [{ kind: 'stageJokboMultAdd', jokbo: id, value: step }],
  };
}

function buildEvolutions(): EvolutionDefinition[] {
  const out: EvolutionDefinition[] = [];
  for (const [jid, theme] of Object.entries(THEMES) as [JokboId, ThemeNames][]) {
    const nk = NAME_KO[jid];
    const isPi = jid === 'pi';
    const waveFrac = jid === 'fullMonth' ? 0.1 : isPi ? 0.12 : 0.2;
    const deepStep = isPi || jid === 'fullMonth' ? 0.06 : 0.1;
    out.push({
      id: `${jid}-endless`,
      jokboId: jid,
      name: theme.endless[0],
      nameEn: theme.endless[1],
      description: `매 스테이지 첫 ${nk} 발동이 한 번 더 발동(재발동).`,
      minLevel: 3,
      specs: [endlessSpec(jid)],
    });
    out.push({
      id: `${jid}-wave`,
      jokboId: jid,
      name: theme.wave[0],
      nameEn: theme.wave[1],
      description: `${nk} 발동 후 이번 스테이지에 ${theme.filterKo}를 획득할 때마다 ${nk} 마지막 점수의 ${Math.round(
        waveFrac * 100,
      )}%를 추가 획득.`,
      minLevel: 3,
      specs: [waveSpec(jid, theme.filter, waveFrac)],
    });
    if (theme.echo) {
      out.push({
        id: `${jid}-echo`,
        jokboId: jid,
        name: theme.echo[0],
        nameEn: theme.echo[1],
        description: `${nk}를 이루는 카드가 모두 강화되어 있으면 ${nk}가 발동할 때마다 재발동.`,
        minLevel: 3,
        specs: [echoSpec(jid)],
      });
    }
    out.push({
      id: `${jid}-deep`,
      jokboId: jid,
      name: theme.deep[0],
      nameEn: theme.deep[1],
      description: `${nk} 완성 후 ${theme.filterKo}를 더 획득할 때마다 이번 스테이지 ${nk} 배율 +${deepStep}.`,
      minLevel: 3,
      specs: [deepSpec(jid, theme.filter, deepStep)],
    });
  }
  // Brights get bespoke evolutions.
  out.push({
    id: 'gwang-endless',
    jokboId: 'gwang',
    name: '끝없는 빛',
    nameEn: 'Endless Light',
    description: '매 스테이지 첫 광 발동이 한 번 더 발동(재발동).',
    minLevel: 3,
    specs: [endlessSpec('gwang')],
  });
  out.push({
    id: 'gwang-radiance',
    jokboId: 'gwang',
    name: '광휘',
    nameEn: 'Radiance',
    description: '광 족보가 발동한 뒤 광을 획득할 때마다 이번 스테이지 전체 배율 +0.2.',
    minLevel: 3,
    specs: [
      {
        trigger: 'CAPTURE_RESOLVED',
        conditions: [
          { kind: 'jokboActive', id: 'gwang' },
          { kind: 'subject', filter: { bright: true } },
        ],
        effects: [{ kind: 'stageGlobalMultAdd', value: 0.2 }],
      },
    ],
  });
  out.push({
    id: 'gwang-crown',
    jokboId: 'gwang',
    name: '왕관',
    nameEn: 'Crown',
    description: '광 족보에 획득한 광 1장당 +120 고정 점수.',
    minLevel: 3,
    specs: [
      {
        trigger: 'SCORE_JOKBO',
        conditions: [{ kind: 'jokbo', ids: ['gwang'] }],
        effects: [{ kind: 'flat', value: { scalar: 'brightsCaptured', times: 120 } }],
      },
    ],
  });
  return out;
}

export const EVOLUTIONS: EvolutionDefinition[] = buildEvolutions();

const EVO_INDEX = new Map(EVOLUTIONS.map((e) => [e.id, e]));

export function getEvolution(id: string): EvolutionDefinition | undefined {
  return EVO_INDEX.get(id);
}

export function evolutionsFor(jokboId: JokboId): EvolutionDefinition[] {
  return EVOLUTIONS.filter((e) => e.jokboId === jokboId);
}
