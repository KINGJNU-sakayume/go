import type { JokboDefinition, JokboId } from '../types';

/**
 * Traditional Jokbo baseline (traditionalPoints are Hwatu points, converted ×100 by the scoring layer).
 * Ribbon sets and Godori are repeatable: every additional disjoint full set scores again —
 * that is how duplicated cards turn into an engine.
 */
export const JOKBO_DEFS: Record<JokboId, JokboDefinition> = {
  gwang: {
    id: 'gwang',
    name: '광',
    nameEn: 'Brights',
    shout: 'GWANG',
    group: 'bright',
    description:
      '광 3장: 삼광 3점 (비광 포함 시 비삼광 2점) · 4장: 사광 4점 · 5장: 오광 15점 · 5장 초과 광 1장마다 +3점.',
    rule: {
      kind: 'gwang',
      tiers: [
        { id: 'bisamgwang', name: '비삼광', nameEn: 'Bisamgwang', count: 3, withRain: true, points: 2 },
        { id: 'samgwang', name: '삼광', nameEn: 'Samgwang', count: 3, points: 3 },
        { id: 'sagwang', name: '사광', nameEn: 'Sagwang', count: 4, points: 4 },
        { id: 'ogwang', name: '오광', nameEn: 'Ogwang', count: 5, points: 15 },
      ],
      perExtraBeyondFive: 3,
    },
    traditionalPoints: 3,
    color: '#f59e0b',
    glyph: '光',
    evolutionIds: ['gwang-endless', 'gwang-radiance', 'gwang-crown'],
  },
  godori: {
    id: 'godori',
    name: '고도리',
    nameEn: 'Godori',
    shout: 'GODORI',
    group: 'animal',
    description: '2월·4월·8월 열끗(새) 세 장. 5점. 열끗 점수와 중첩. 추가로 세트를 모으면 또 득점.',
    rule: {
      kind: 'set',
      slots: [
        { month: 2, need: 'animal', label: '2월 새' },
        { month: 4, need: 'animal', label: '4월 새' },
        { month: 8, need: 'animal', label: '8월 새' },
      ],
      pointsPerSet: 5,
      repeatable: true,
    },
    traditionalPoints: 5,
    color: '#0ea5e9',
    glyph: '鳥',
    evolutionIds: ['godori-endless', 'godori-wave', 'godori-echo', 'godori-deep'],
  },
  hongdan: {
    id: 'hongdan',
    name: '홍단',
    nameEn: 'Hongdan',
    shout: 'HONGDAN',
    group: 'ribbonSet',
    description: '1·2·3월 홍단 띠. 3점. 띠 점수와 중첩.',
    rule: {
      kind: 'set',
      slots: [
        { month: 1, need: 'ribbon', ribbonType: 'hongdan', label: '1월 홍단' },
        { month: 2, need: 'ribbon', ribbonType: 'hongdan', label: '2월 홍단' },
        { month: 3, need: 'ribbon', ribbonType: 'hongdan', label: '3월 홍단' },
      ],
      pointsPerSet: 3,
      repeatable: true,
    },
    traditionalPoints: 3,
    color: '#dc2626',
    glyph: '紅',
    evolutionIds: ['hongdan-endless', 'hongdan-wave', 'hongdan-echo', 'hongdan-deep'],
  },
  cheongdan: {
    id: 'cheongdan',
    name: '청단',
    nameEn: 'Cheongdan',
    shout: 'CHEONGDAN',
    group: 'ribbonSet',
    description: '6·9·10월 청단 띠. 3점. 띠 점수와 중첩.',
    rule: {
      kind: 'set',
      slots: [
        { month: 6, need: 'ribbon', ribbonType: 'cheongdan', label: '6월 청단' },
        { month: 9, need: 'ribbon', ribbonType: 'cheongdan', label: '9월 청단' },
        { month: 10, need: 'ribbon', ribbonType: 'cheongdan', label: '10월 청단' },
      ],
      pointsPerSet: 3,
      repeatable: true,
    },
    traditionalPoints: 3,
    color: '#2563eb',
    glyph: '靑',
    evolutionIds: ['cheongdan-endless', 'cheongdan-wave', 'cheongdan-echo', 'cheongdan-deep'],
  },
  chodan: {
    id: 'chodan',
    name: '초단',
    nameEn: 'Chodan',
    shout: 'CHODAN',
    group: 'ribbonSet',
    description: '4·5·7월 초단 띠. 3점. 띠 점수와 중첩.',
    rule: {
      kind: 'set',
      slots: [
        { month: 4, need: 'ribbon', ribbonType: 'chodan', label: '4월 초단' },
        { month: 5, need: 'ribbon', ribbonType: 'chodan', label: '5월 초단' },
        { month: 7, need: 'ribbon', ribbonType: 'chodan', label: '7월 초단' },
      ],
      pointsPerSet: 3,
      repeatable: true,
    },
    traditionalPoints: 3,
    color: '#16a34a',
    glyph: '草',
    evolutionIds: ['chodan-endless', 'chodan-wave', 'chodan-echo', 'chodan-deep'],
  },
  animal: {
    id: 'animal',
    name: '열끗',
    nameEn: 'Animals',
    shout: 'ANIMALS',
    group: 'animal',
    description: '열끗 5장 1점, 이후 1장마다 +1점.',
    rule: { kind: 'count', measure: 'animal', threshold: 5, basePoints: 1, perExtra: 1 },
    traditionalPoints: 1,
    color: '#0891b2',
    glyph: '獸',
    evolutionIds: ['animal-endless', 'animal-wave', 'animal-deep'],
  },
  ribbon: {
    id: 'ribbon',
    name: '띠',
    nameEn: 'Ribbons',
    shout: 'RIBBONS',
    group: 'ribbon',
    description: '유효한 띠 5장 1점, 이후 1장마다 +1점. (비 띠는 기본 규칙상 제외)',
    rule: { kind: 'count', measure: 'ribbon', threshold: 5, basePoints: 1, perExtra: 1 },
    traditionalPoints: 1,
    color: '#9333ea',
    glyph: '帶',
    evolutionIds: ['ribbon-endless', 'ribbon-wave', 'ribbon-deep'],
  },
  pi: {
    id: 'pi',
    name: '피',
    nameEn: 'Pi',
    shout: 'PI',
    group: 'pi',
    description: '피 가치 10 = 1점, 이후 1마다 +1점. 쌍피는 2로 셈.',
    rule: { kind: 'count', measure: 'pi', threshold: 10, basePoints: 1, perExtra: 1 },
    traditionalPoints: 1,
    color: '#65a30d',
    glyph: '皮',
    evolutionIds: ['pi-endless', 'pi-wave', 'pi-deep'],
  },
  fullMonth: {
    id: 'fullMonth',
    name: '한 달 모음',
    nameEn: 'Full Month',
    shout: 'FULL MONTH',
    group: 'month',
    description: '같은 달 카드 4장마다 2점 (로그라이크 확장 족보 — 달 빌드용).',
    rule: { kind: 'fullMonth', setSize: 4, pointsPerSet: 2 },
    traditionalPoints: 2,
    color: '#b45309',
    glyph: '月',
    evolutionIds: ['fullMonth-endless', 'fullMonth-wave', 'fullMonth-deep'],
  },
};

export function getJokboDef(id: JokboId): JokboDefinition {
  return JOKBO_DEFS[id];
}

export const RIBBON_SET_IDS: JokboId[] = ['hongdan', 'cheongdan', 'chodan'];
