import type { EventChoice, EventEncounterDefinition, EventState, OutcomeStep, RunState } from '../types';
import { deriveRng, type Rng } from '../rng/rng';
import { getCardDef } from '../cards/definitions';
import { ENHANCEMENTS } from '../cards/enhancements';
import { allTalismans, getTalismanDef } from '../talismans/registry';
import { rollTalisman } from '../rewards/rewards';
import { cardName, filterCards, runOutcomes } from '../engine/operations';
import { cloneRun } from '../engine/stage';

type EventBody = Pick<EventState, 'title' | 'titleEn' | 'text' | 'choices' | 'shownCards'>;

export interface EventDefinition extends EventEncounterDefinition {
  setup: (run: RunState, rng: Rng) => EventBody;
}

const LEAVE: EventChoice = { id: 'leave', label: '떠난다', description: '아무 일도 일어나지 않음.', steps: [] };

function hasCards(run: RunState, filter: Parameters<typeof filterCards>[1]): boolean {
  return filterCards(run, filter).length > 0;
}

function interactive(
  kind: Extract<OutcomeStep, { op: 'interactive' }>['operation']['kind'],
  title: string,
  extra: Partial<Extract<OutcomeStep, { op: 'interactive' }>['operation']> = {},
): OutcomeStep {
  return {
    op: 'interactive',
    operation: { kind, title, description: '대상을 고르세요.', source: 'event', count: 1, cancellable: false, ...extra },
  };
}

function minOk(run: RunState, removing: number): string | undefined {
  return run.deck.length - removing < run.rules.minDeckSize ? `덱이 최소 ${run.rules.minDeckSize}장보다 작아짐` : undefined;
}

export const EVENTS: EventDefinition[] = [
  {
    id: 'shrine',
    name: '산신당',
    nameEn: 'Mountain Shrine',
    teaser: '공물을 바치면 산신이 응답한다.',
    tags: ['thin'],
    setup: (run, rng) => {
      const t = rollTalisman(run, rng, { common: 0.2, uncommon: 0.5, rare: 0.3, mythic: 0.05 });
      const choices: EventChoice[] = [];
      if (t) {
        choices.push({
          id: 'sacrifice',
          label: `카드 한 장 희생 → 부적 「${t.name}」`,
          description: t.description,
          disabled: minOk(run, 1),
          steps: [
            interactive('removeCard', '산신당: 바칠 카드', { sacrifice: true, description: '희생할 카드를 고르세요.' }),
            { op: 'gainTalisman', talismanId: t.id },
          ],
        });
      }
      choices.push({
        id: 'donate',
        label: '엽전 8 시주 → 족보 하나 수련 (+1)',
        description: '원하는 족보의 레벨을 올림.',
        cost: 8,
        disabled: run.coins < 8 ? '엽전 부족' : undefined,
        steps: [interactive('upgradeJokbo', '산신당: 족보 수련', { count: 0, levels: 1, description: '수련할 족보를 고르세요.' })],
      });
      choices.push(LEAVE);
      return { title: '산신당', titleEn: 'Mountain Shrine', text: '이끼 낀 작은 사당. 향 연기 속에서 누군가 공물을 기다린다.', choices, shownCards: [] };
    },
  },
  {
    id: 'painter',
    name: '떠돌이 화공',
    nameEn: 'Wandering Painter',
    teaser: '붓 한 번이면 카드가 다른 달이 된다.',
    tags: ['month', 'mutation'],
    setup: () => ({
      title: '떠돌이 화공',
      titleEn: 'Wandering Painter',
      text: '"그 패, 내 붓이면 다른 달로 피어날 텐데."',
      shownCards: [],
      choices: [
        { id: 'month', label: '달을 다시 그린다', description: '카드 한 장의 달을 원하는 달로 바꿈 (달 바꾸기).', steps: [interactive('monthShift', '화공: 달 다시 그리기')] },
        { id: 'category', label: '종류를 덧그린다', description: '카드 한 장에 종류 하나 추가 (종류 접목).', steps: [interactive('typeGraft', '화공: 종류 덧그리기')] },
        { ...LEAVE, label: '거절한다' },
      ],
    }),
  },
  {
    id: 'torn',
    name: '찢어진 화투',
    nameEn: 'Torn Hwatu',
    teaser: '찢어진 두 장. 버릴까, 고칠까.',
    tags: ['thin'],
    setup: (run, rng) => {
      const pool = run.deck.filter((c) => getCardDef(c.defId).category !== 'joker');
      const shown = rng.sample(pool, 2).map((c) => c.uid);
      const names = shown.map((u) => cardName(run, u)).join(', ');
      return {
        title: '찢어진 화투',
        titleEn: 'Torn Hwatu',
        text: `덱 속에서 두 장이 찢어져 있다: ${names}.`,
        shownCards: shown,
        choices: [
          {
            id: 'discard',
            label: '둘 다 버리고 저주받은 패 한 장을 받는다',
            description: '두 장 제거 + 무작위 카드(Lv.3, 저주 인챈트: 파워 +30, 족보 ×1.3, 손에 들어올 때 교환 -1) 추가.',
            disabled: minOk(run, 1),
            steps: [{ op: 'removeCards', uids: shown }, { op: 'addCursedCard' }],
          },
          { id: 'repair', label: '정성껏 고친다', description: '두 장 모두 레벨 +1.', steps: [{ op: 'upgradeCards', uids: shown, levels: 1 }] },
        ],
      };
    },
  },
  {
    id: 'moonMarket',
    name: '달밤 시장',
    nameEn: 'Moonlit Market',
    teaser: '달빛 아래에서만 파는 기묘한 복제.',
    tags: ['month'],
    setup: (run, rng) => {
      const best = [...run.deck].sort((a, b) => b.level - a.level || b.enhancements.length - a.enhancements.length)[0];
      const ribbons = run.deck.filter((c) => getCardDef(c.defId).category === 'ribbon');
      const brights = run.deck.filter((c) => getCardDef(c.defId).category === 'bright');
      const ribbon = rng.pickOrUndefined(ribbons);
      const bright = rng.pickOrUndefined(brights);
      const choices: EventChoice[] = [];
      if (best) {
        choices.push({
          id: 'perfect',
          label: `완전 복제: ${cardName(run, best.uid)} Lv.${best.level}`,
          description: '가장 높은 레벨의 카드를 강화째로 복제 (반값).',
          cost: 8,
          disabled: run.coins < 8 ? '엽전 부족' : undefined,
          steps: [{ op: 'cloneCard', uid: best.uid, exact: true }],
        });
      }
      if (ribbon) {
        choices.push({
          id: 'ribbon',
          label: `띠 복제: ${cardName(run, ribbon.uid)}`,
          description: '기본형 복제.',
          cost: 3,
          disabled: run.coins < 3 ? '엽전 부족' : undefined,
          steps: [{ op: 'cloneCard', uid: ribbon.uid, exact: false }],
        });
      }
      if (bright) {
        choices.push({
          id: 'bright',
          label: `광 복제: ${cardName(run, bright.uid)}`,
          description: '기본형 복제 — 광이 두 장이 된다.',
          cost: 5,
          disabled: run.coins < 5 ? '엽전 부족' : undefined,
          steps: [{ op: 'cloneCard', uid: bright.uid, exact: false }],
        });
      }
      choices.push(LEAVE);
      return { title: '달밤 시장', titleEn: 'Moonlit Market', text: '보름달 아래 좌판. 상인은 같은 패를 하나 더 만들어 준다고 한다.', choices, shownCards: [] };
    },
  },
  {
    id: 'dokkaebiBet',
    name: '도깨비 내기',
    nameEn: "Dokkaebi's Wager",
    teaser: '강화된 패를 걸고 한 판.',
    tags: ['mutation'],
    setup: (run) => ({
      title: '도깨비 내기',
      titleEn: "Dokkaebi's Wager",
      text: '"네 패 중 반짝이는 놈 하나 걸어 봐. 이기면 똑같은 놈을 하나 더 주지."',
      shownCards: [],
      choices: [
        {
          id: 'bet',
          label: '강화된 카드를 건다',
          description: '승리 55%: 그 카드를 완전 복제. 패배 45%: 그 카드에 저주 변이.',
          probability: 0.55,
          disabled: hasCards(run, { enhanced: true }) ? undefined : '강화된 카드 없음',
          steps: [interactive('gambleCard', '도깨비 내기: 걸 카드', { chance: 0.55 })],
        },
        { ...LEAVE, label: '거절한다' },
      ],
    }),
  },
  {
    id: 'rainPavilion',
    name: '비 오는 정자',
    nameEn: 'Rainy Pavilion',
    teaser: '빗소리 속에서 비 카드가 깨어난다.',
    tags: ['bright'],
    setup: (run) => {
      const rainBright = run.deck.find((c) => getCardDef(c.defId).rainBright && !c.mutations.some((m) => m.id === 'clearSky'));
      return {
        title: '비 오는 정자',
        titleEn: 'Rainy Pavilion',
        text: '처마 끝에 빗방울이 맺힌다. 12월의 패들이 조용히 울린다.',
        shownCards: rainBright ? [rainBright.uid] : [],
        choices: [
          {
            id: 'rain',
            label: '비 카드 하나를 강화 (+2)',
            description: '12월(비) 카드 한 장 레벨 +2.',
            disabled: hasCards(run, { rain: true }) ? undefined : '비 카드 없음',
            steps: [interactive('upgradeCard', '정자: 비 카드 강화', { filter: { rain: true }, levels: 2 })],
          },
          {
            id: 'clear',
            label: '비광을 맑게 갠다',
            description: '비광이 더 이상 비광 취급되지 않고(삼광 감점 없음) 레벨 +1.',
            disabled: rainBright ? undefined : '비광 없음',
            steps: rainBright ? [{ op: 'mutateSpecific', uid: rainBright.uid, mutation: { id: 'clearSky' }, levels: 1 }] : [],
          },
          LEAVE,
        ],
      };
    },
  },
  {
    id: 'gamblerLedger',
    name: '노름꾼의 장부',
    nameEn: "Gambler's Ledger",
    teaser: '지금 돈을 빌리고, 다음 보스가 대가를 받는다.',
    tags: ['economy'],
    setup: () => ({
      title: '노름꾼의 장부',
      titleEn: "Gambler's Ledger",
      text: '"지금 엽전을 두둑이 주지. 대신 다음 판 큰손(보스)이 좀 더 세게 나올 거야."',
      shownCards: [],
      choices: [
        {
          id: 'borrow',
          label: '엽전 25를 받는다',
          description: '다음 보스 스테이지 목표 점수 ×1.3.',
          steps: [{ op: 'gainCoins', amount: 25 }, { op: 'runModifier', key: 'bossTargetMult', value: 1.3, mode: 'mult' }],
        },
        { ...LEAVE, label: '거절한다' },
      ],
    }),
  },
  {
    id: 'seamstress',
    name: '바느질 장인',
    nameEn: 'Master Seamstress',
    teaser: '띠에 두 번째 달을 꿰맨다.',
    tags: ['ribbon', 'month'],
    setup: (run) => ({
      title: '바느질 장인',
      titleEn: 'Master Seamstress',
      text: '"띠 하나에 달 두 개를 꿰매 줄 수 있소."',
      shownCards: [],
      choices: [
        {
          id: 'split',
          label: '띠에 두 번째 달을 꿰맨다',
          description: '띠 한 장에 갈라진 달 (두 번째 달 추가, 매칭 + 점수).',
          disabled: hasCards(run, { categories: ['ribbon'] }) ? undefined : '띠 없음',
          steps: [interactive('splitMoon', '바느질: 두 번째 달', { filter: { categories: ['ribbon'] } })],
        },
        {
          id: 'reinforce',
          label: '띠를 덧대어 튼튼하게',
          description: `띠 한 장에 ${ENHANCEMENTS.reinforced.name} 인챈트 (파워 +10, 중첩).`,
          disabled: hasCards(run, { categories: ['ribbon'] }) ? undefined : '띠 없음',
          steps: [interactive('enhanceCard', '바느질: 덧대기', { filter: { categories: ['ribbon'] }, enhancement: 'reinforced' })],
        },
        { ...LEAVE, label: '거절한다' },
      ],
    }),
  },
  {
    id: 'oldCard',
    name: '오래된 패',
    nameEn: 'The Old Card',
    teaser: '낡은 패를 부수거나, 고대의 힘을 깨운다.',
    tags: ['thin', 'mutation'],
    setup: (run) => ({
      title: '오래된 패',
      titleEn: 'The Old Card',
      text: '손때 묻은 낮은 레벨의 패에서 오래된 기운이 느껴진다.',
      shownCards: [],
      choices: [
        {
          id: 'destroy',
          label: 'Lv.2 이하 카드를 부순다',
          description: '그 카드 제거 + 영구 전체 배율 +0.1.',
          disabled: minOk(run, 1) ?? (hasCards(run, { maxLevel: 2 }) ? undefined : '해당 카드 없음'),
          steps: [
            interactive('removeCard', '오래된 패: 부술 카드', { filter: { maxLevel: 2 }, sacrifice: true }),
            { op: 'runModifier', key: 'permanentGlobalAdd', value: 0.1, mode: 'add' },
          ],
        },
        {
          id: 'ancient',
          label: '고대의 패로 깨운다',
          description: 'Lv.2 이하 카드 한 장 레벨 +4, 대신 무작위 저주 변이.',
          disabled: hasCards(run, { maxLevel: 2, joker: false }) ? undefined : '해당 카드 없음',
          steps: [interactive('ancientCard', '오래된 패: 깨울 카드', { filter: { maxLevel: 2 } })],
        },
        LEAVE,
      ],
    }),
  },
  {
    id: 'lostCard',
    name: '잃어버린 한 장',
    nameEn: 'The Lost Card',
    teaser: '어느 달의 카드가 길을 잃었다.',
    tags: ['month'],
    setup: () => ({
      title: '잃어버린 한 장',
      titleEn: 'The Lost Card',
      text: '길가에 화투 한 장이 떨어져 있다. 어느 달인지는 당신이 정한다.',
      shownCards: [],
      choices: [
        { id: 'discover', label: '달을 골라 찾는다', description: '고른 달의 무작위 카드 1장을 덱에 추가.', steps: [interactive('discoverMonth', '잃어버린 한 장', { count: 0 })] },
        LEAVE,
      ],
    }),
  },
  {
    id: 'drinkTable',
    name: '술상',
    nameEn: 'Drinking Table',
    teaser: '국화주 한 상이 차려져 있다.',
    tags: ['month'],
    setup: (run) => ({
      title: '술상',
      titleEn: 'Drinking Table',
      text: '국화 띄운 술잔이 넘실거린다.',
      shownCards: [],
      choices: [
        {
          id: 'drink',
          label: '한 잔 들이켠다',
          description: '다음 스테이지 동안 전체 배율 +0.5.',
          steps: [{ op: 'runModifier', key: 'nextStageGlobalAdd', value: 0.5, mode: 'add' }],
        },
        {
          id: 'pour',
          label: '9월 카드에 술을 붓는다',
          description: '9월 카드 한 장 레벨 +2와 황금 인챈트.',
          disabled: hasCards(run, { months: [9], joker: false }) ? undefined : '9월 카드 없음',
          steps: [interactive('upgradeCard', '술상: 9월 카드', { filter: { months: [9], joker: false }, levels: 2, addEnhancement: 'golden' })],
        },
        {
          id: 'gamble',
          label: '엽전 6으로 노름',
          description: '50%: 희귀 부적. 50%: 빈손.',
          cost: 6,
          probability: 0.5,
          disabled: run.coins < 6 ? '엽전 부족' : undefined,
          steps: [{ op: 'gamble', chance: 0.5, label: '술상 노름', win: [{ op: 'gainRandomTalisman', rarity: 'rare' }], lose: [{ op: 'message', text: '술값만 날렸다' }] }],
        },
      ],
    }),
  },
  {
    id: 'birds',
    name: '새떼',
    nameEn: 'Flock of Birds',
    teaser: '하늘을 덮은 새떼 — 고도리의 징조.',
    tags: ['godori', 'animal'],
    setup: (run) => {
      const devoted = hasCards(run, { godori: true, enhanced: true });
      const owned = new Set(run.talismans.map((t) => t.id));
      if (devoted) {
        const choices: EventChoice[] = [
          { id: 'jokbo', label: '고도리 족보 +2', description: '새를 모시는 자에게 주는 선물.', steps: [{ op: 'upgradeJokboFixed', jokboId: 'godori', levels: 2 }] },
          {
            id: 'echo',
            label: '새 한 마리에 메아리',
            description: '고도리 새 카드 하나에 메아리 인챈트.',
            steps: [interactive('enhanceCard', '새떼: 메아리', { filter: { godori: true }, enhancement: 'echo' })],
          },
        ];
        const cage = !owned.has('birdcage') ? 'birdcage' : !owned.has('flock') ? 'flock' : undefined;
        if (cage) choices.push({ id: 'cage', label: `부적 「${getTalismanDef(cage)?.name}」`, description: getTalismanDef(cage)?.description ?? '', steps: [{ op: 'gainTalisman', talismanId: cage }] });
        return { title: '새떼', titleEn: 'Flock of Birds', text: '새들이 당신의 강화된 새 카드를 알아보고 내려앉는다.', choices, shownCards: [] };
      }
      return {
        title: '새떼',
        titleEn: 'Flock of Birds',
        text: '새떼가 머리 위를 지나간다.',
        shownCards: [],
        choices: [
          {
            id: 'upgrade',
            label: '새 카드 하나 강화 (+1)',
            description: '2·4·8월 새(열끗) 카드 레벨 +1.',
            disabled: hasCards(run, { godori: true }) ? undefined : '새 카드 없음',
            steps: [interactive('upgradeCard', '새떼: 새 카드', { filter: { godori: true }, levels: 1 })],
          },
          {
            id: 'flock',
            label: '엽전 6: 부적 「새떼」',
            description: getTalismanDef('flock')?.description ?? '',
            cost: 6,
            disabled: owned.has('flock') ? '이미 보유' : run.coins < 6 ? '엽전 부족' : undefined,
            steps: [{ op: 'gainTalisman', talismanId: 'flock' }],
          },
          LEAVE,
        ],
      };
    },
  },
  {
    id: 'flowerViewing',
    name: '꽃놀이',
    nameEn: 'Flower Viewing',
    teaser: '지금의 힘을 내주고 영원한 꽃을 얻는다.',
    tags: ['hongdan'],
    setup: (run) => ({
      title: '꽃놀이',
      titleEn: 'Flower Viewing',
      text: '벚꽃 아래 술자리. 오늘을 즐기면 내일이 조금 무거워진다.',
      shownCards: [],
      choices: [
        {
          id: 'hongdan',
          label: '다음 스테이지 점수 ×0.8 → 모든 홍단 영구 +1',
          description: '덱의 모든 홍단 띠 레벨 +1.',
          disabled: hasCards(run, { ribbonTypes: ['hongdan'] }) ? undefined : '홍단 없음',
          steps: [
            { op: 'runModifier', key: 'nextStageScoreMult', value: 0.8, mode: 'mult' },
            { op: 'upgradeMatching', filter: { ribbonTypes: ['hongdan'] }, levels: 1 },
          ],
        },
        {
          id: 'march',
          label: '다음 스테이지 교환 -1 → 3월 카드 복제',
          description: '3월 카드 한 장의 기본형 복제.',
          disabled: hasCards(run, { months: [3], joker: false }) ? undefined : '3월 카드 없음',
          steps: [
            { op: 'runModifier', key: 'nextStageExchangeBonus', value: -1, mode: 'add' },
            interactive('duplicateCard', '꽃놀이: 3월 카드', { filter: { months: [3], joker: false } }),
          ],
        },
        LEAVE,
      ],
    }),
  },
  {
    id: 'swindler',
    name: '장터의 사기꾼',
    nameEn: 'Market Swindler',
    teaser: '덮인 상품 셋. 엿보는 데도 돈이 든다.',
    tags: ['economy'],
    setup: (run, rng) => {
      const t = rollTalisman(run, rng, { common: 0, uncommon: 0.4, rare: 0.5, mythic: 0.1 });
      const goods: { label: string; description: string; price: number; steps: OutcomeStep[] }[] = [
        { label: '진짜 엽전 주머니', description: '엽전 15.', price: 4, steps: [{ op: 'gainCoins', amount: 15 }] },
        { label: '가짜 부적', description: '아무것도 없다. 오히려 무작위 카드에 저주.', price: 5, steps: [{ op: 'randomCurse' }] },
        { label: '족보 비급', description: '무작위 족보 하나 Lv+2.', price: 7, steps: [{ op: 'randomRareReward' }] },
      ];
      if (t) goods.push({ label: `부적 「${t.name}」`, description: t.description, price: 9, steps: [{ op: 'gainTalisman', talismanId: t.id }] });
      const picked = rng.sample(goods, 3);
      const choices: EventChoice[] = [];
      picked.forEach((g, i) => {
        choices.push({
          id: `buy-${i}`,
          label: `덮인 상품 ${i + 1}: ${g.label}`,
          description: g.description,
          cost: g.price,
          concealed: true,
          disabled: run.coins < g.price ? '엽전 부족' : undefined,
          steps: g.steps,
        });
        choices.push({ id: `reveal-${i}`, label: `상품 ${i + 1} 엿보기`, description: '엽전 2를 내고 내용을 확인.', cost: 2, keepOpen: true, reveals: `buy-${i}`, steps: [] });
      });
      choices.push(LEAVE);
      return { title: '장터의 사기꾼', titleEn: 'Market Swindler', text: '"골라 봐, 골라 봐! 뭐가 들었는지는… 비밀이지."', choices, shownCards: [] };
    },
  },
  {
    id: 'abandonedBox',
    name: '폐가의 상자',
    nameEn: 'Box in the Ruins',
    teaser: '희귀한 보물, 그리고 저주.',
    tags: ['mutation'],
    setup: () => ({
      title: '폐가의 상자',
      titleEn: 'Box in the Ruins',
      text: '무너진 집 안에 봉인된 상자가 있다. 손잡이가 차갑다.',
      shownCards: [],
      choices: [
        { id: 'open', label: '상자를 연다', description: '무작위 희귀 보상 + 무작위 카드에 저주 변이.', steps: [{ op: 'randomRareReward' }, { op: 'randomCurse' }] },
        { ...LEAVE, label: '안전하게 떠난다' },
      ],
    }),
  },
];

const INDEX = new Map(EVENTS.map((e) => [e.id, e]));

export function getEventDef(id: string): EventDefinition | undefined {
  return INDEX.get(id);
}

export function createEventState(run: RunState, eventId: string): EventState {
  const def = getEventDef(eventId);
  if (!def) throw new Error(`Unknown event ${eventId}`);
  const rng = deriveRng(run.seed, 'event', eventId, run.stageIndex);
  const body = def.setup(run, rng);
  return { eventId, ...body, resolved: false, revealed: [] };
}

export function chooseEventOption(run: RunState, choiceId: string): RunState {
  const next = cloneRun(run);
  const ev = next.event;
  if (!ev || ev.resolved) throw new Error('No open event');
  if (next.ops.length) throw new Error('먼저 진행 중인 선택을 끝내세요');
  const choice = ev.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error('Unknown choice');
  if (choice.disabled) throw new Error(choice.disabled);
  const cost = choice.cost ?? 0;
  if (next.coins < cost) throw new Error('엽전 부족');
  next.coins -= cost;
  if (choice.reveals) {
    if (!ev.revealed.includes(choice.reveals)) ev.revealed.push(choice.reveals);
    ev.choices = ev.choices.filter((c) => c.id !== choice.id);
    return next;
  }
  if (!next.usedEvents.includes(ev.eventId)) next.usedEvents.push(ev.eventId);
  runOutcomes(next, choice.steps);
  if (!choice.keepOpen) {
    ev.resolved = true;
    ev.resultText = choice.id === 'leave' ? '조용히 자리를 떴다.' : `${choice.label}`;
  }
  return next;
}

export function eventTalismanName(id: string): string {
  return allTalismans().find((t) => t.id === id)?.name ?? id;
}
