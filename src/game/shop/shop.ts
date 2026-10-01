import type { OutcomeStep, Rarity, RunState, ShopOffer, ShopServiceKind, ShopState } from '../types';
import { BALANCE } from '../config/balance';
import { deriveRng, type Rng } from '../rng/rng';
import { ENHANCEMENTS } from '../cards/enhancements';
import { MUTATIONS } from '../cards/mutations';
import { getCardDef } from '../cards/definitions';
import { JOKBO_DEFS } from '../jokbo/definitions';
import { ALL_JOKBO } from '../types';
import { getTalismanDef } from '../talismans/registry';
import { makeContext } from '../effects/context';
import { hasTalisman } from '../effects/sources';
import { rollTalisman, talismanRarityWeights, jokboUpgradePreview } from '../rewards/rewards';
import { emitRunEvent } from '../engine/runEvents';
import { runOutcomes } from '../engine/operations';
import { cloneRun } from '../engine/stage';

const SERVICE_INFO: Record<ShopServiceKind, { title: string; description: string; rarity: Rarity }> = {
  removal: { title: '카드 제거', description: '덱에서 카드 한 장을 영구히 지움. 반복 구매 가능 (점점 비싸짐).', rarity: 'common' },
  upgrade: { title: '카드 강화', description: '카드 한 장 레벨 +1.', rarity: 'common' },
  mutation: { title: '카드 변이', description: '카드 한 장에 변이 3개 중 하나.', rarity: 'rare' },
  duplicate: { title: '카드 복제', description: '카드 한 장의 기본형을 덱에 추가.', rarity: 'uncommon' },
  perfectClone: { title: '완전 복제', description: '레벨·강화·변이까지 그대로 복제.', rarity: 'rare' },
  jokboTraining: { title: '족보 수련', description: '족보 레벨 +1.', rarity: 'uncommon' },
  talisman: { title: '부적', description: '', rarity: 'common' },
  jokerWorkshop: { title: '조커 공방', description: '조커 한 장을 특수 조커로 변신.', rarity: 'rare' },
  monthDye: { title: '달 염색', description: '카드 한 장의 달을 원하는 달로 바꿈.', rarity: 'uncommon' },
  ribbonDye: { title: '띠 염색', description: '띠 한 장을 원하는 홍단/청단/초단 칸으로 바꿈.', rarity: 'uncommon' },
  purify: { title: '정화', description: '카드 한 장의 저주(부정 효과) 하나를 제거.', rarity: 'common' },
  enhancement: { title: '강화 인챈트', description: '', rarity: 'uncommon' },
  addJoker: { title: '조커 구입', description: '서비스 조커 1장을 덱에 추가.', rarity: 'uncommon' },
};

function hasNegative(run: RunState): boolean {
  return run.deck.some((c) => c.mutations.some((m) => MUTATIONS[m.id].negative) || c.enhancements.some((e) => e.id === 'cursed'));
}

function hasJoker(run: RunState): boolean {
  return run.deck.some((c) => getCardDef(c.defId).category === 'joker');
}

function hasRibbon(run: RunState): boolean {
  return run.deck.some((c) => getCardDef(c.defId).category === 'ribbon');
}

export function removalPrice(run: RunState): number {
  return BALANCE.removalPrice(run.removals);
}

function serviceOffer(run: RunState, rng: Rng, service: ShopServiceKind, idx: number): ShopOffer | undefined {
  const info = SERVICE_INFO[service];
  const base: ShopOffer = {
    id: `o${idx}-${service}`,
    service,
    title: info.title,
    description: info.description,
    price: BALANCE.servicePrice[service],
    rarity: info.rarity,
    sold: false,
    repeatable: false,
  };
  switch (service) {
    case 'jokboTraining': {
      const j = rng.pick(ALL_JOKBO);
      const lv = run.jokbo[j].level;
      return {
        ...base,
        title: `족보 수련: ${JOKBO_DEFS[j].name}`,
        description: JOKBO_DEFS[j].description,
        price: BALANCE.servicePrice.jokboTraining + 2 * (lv - 1),
        jokboId: j,
        preview: jokboUpgradePreview(run, j, 1),
      };
    }
    case 'enhancement': {
      const enh = rng.pick(['reinforced', 'golden', 'echo', 'dualMonth', 'adjacentMonth', 'wildMonth', 'bloom', 'collector', 'catalyst', 'lucky', 'hollow'] as const);
      const def = ENHANCEMENTS[enh];
      const price = def.rarity === 'rare' ? 11 : def.rarity === 'uncommon' ? 8 : 5;
      return { ...base, title: `인챈트: ${def.name}`, description: def.description, price, rarity: def.rarity, enhancement: enh };
    }
    case 'jokerWorkshop':
      return hasJoker(run) ? base : undefined;
    case 'purify':
      return hasNegative(run) ? base : undefined;
    case 'ribbonDye':
      return hasRibbon(run) ? base : undefined;
    default:
      return base;
  }
}

function generateOffers(run: RunState, nodeIndex: number, rerolls: number): ShopOffer[] {
  const rng = deriveRng(run.seed, 'shop', nodeIndex, rerolls);
  const offers: ShopOffer[] = [
    {
      id: `o0-removal`,
      service: 'removal',
      title: SERVICE_INFO.removal.title,
      description: SERVICE_INFO.removal.description,
      price: removalPrice(run),
      rarity: 'common',
      sold: false,
      repeatable: true,
    },
  ];
  const weights = talismanRarityWeights(run.stageIndex, 0);
  const picked: string[] = [];
  for (let i = 0; i < 2; i++) {
    const t = rollTalisman(run, rng, weights, picked);
    if (!t) continue;
    picked.push(t.id);
    offers.push({
      id: `o${offers.length}-t-${t.id}`,
      service: 'talisman',
      title: `부적: ${t.name}`,
      description: t.description,
      price: BALANCE.talismanPrice[t.rarity],
      rarity: t.rarity,
      sold: false,
      repeatable: false,
      talismanId: t.id,
    });
  }
  const pool: { item: ShopServiceKind; weight: number }[] = [
    { item: 'upgrade', weight: 3 },
    { item: 'mutation', weight: 1.5 },
    { item: 'duplicate', weight: 2 },
    { item: 'perfectClone', weight: 0.6 },
    { item: 'jokboTraining', weight: 2.5 },
    { item: 'jokerWorkshop', weight: 0.8 },
    { item: 'monthDye', weight: 1.5 },
    { item: 'ribbonDye', weight: 1.2 },
    { item: 'purify', weight: hasNegative(run) ? 2 : 0 },
    { item: 'enhancement', weight: 2 },
    { item: 'addJoker', weight: 0.6 },
  ];
  const used = new Set<ShopServiceKind>();
  let guard = 0;
  while (offers.length < 6 && guard++ < 40) {
    const avail = pool.filter((p) => p.weight > 0 && !used.has(p.item));
    if (!avail.length) break;
    const s = rng.weighted(avail);
    used.add(s);
    const offer = serviceOffer(run, rng, s, offers.length);
    if (offer) offers.push(offer);
  }
  return offers;
}

export function generateShop(run: RunState, nodeIndex: number): ShopState {
  return { nodeIndex, offers: generateOffers(run, nodeIndex, 0), rerolls: 0, purchasesHere: 0, piRemovalDiscountUsed: false };
}

export function rerollPrice(shop: ShopState): number {
  return BALANCE.rerollPrice(shop.rerolls);
}

export function currentPrice(run: RunState, offer: ShopOffer): number {
  return offer.service === 'removal' ? removalPrice(run) : offer.price;
}

function offerSteps(offer: ShopOffer, price: number, amplified: boolean): OutcomeStep[] {
  const interactive = (kind: Parameters<typeof makeInteractive>[0], extra: Record<string, unknown> = {}): OutcomeStep =>
    makeInteractive(kind, offer.title, price, extra);
  switch (offer.service) {
    case 'removal':
      return [interactive('removeCard')];
    case 'upgrade':
      return [interactive('upgradeCard', { levels: amplified ? 2 : 1 })];
    case 'mutation':
      return [interactive('mutateCard')];
    case 'duplicate':
      return [interactive('duplicateCard')];
    case 'perfectClone':
      return [interactive('perfectClone')];
    case 'jokboTraining':
      return [{ op: 'upgradeJokboFixed', jokboId: offer.jokboId!, levels: amplified ? 2 : 1 }];
    case 'talisman':
      return [{ op: 'gainTalisman', talismanId: offer.talismanId! }];
    case 'jokerWorkshop':
      return [interactive('jokerWorkshop')];
    case 'monthDye':
      return [interactive('monthShift')];
    case 'ribbonDye':
      return [interactive('ribbonDye')];
    case 'purify':
      return [interactive('purify')];
    case 'enhancement':
      return [interactive('enhanceCard', { enhancement: offer.enhancement })];
    case 'addJoker':
      return [{ op: 'addJoker', form: 'service' }];
  }
}

function makeInteractive(
  kind: 'removeCard' | 'upgradeCard' | 'mutateCard' | 'duplicateCard' | 'perfectClone' | 'jokerWorkshop' | 'monthShift' | 'ribbonDye' | 'purify' | 'enhanceCard',
  title: string,
  price: number,
  extra: Record<string, unknown>,
): OutcomeStep {
  return {
    op: 'interactive',
    operation: {
      kind,
      title,
      description: '대상 카드를 고르세요. (취소하면 환불)',
      source: 'shop',
      count: 1,
      cancellable: true,
      refund: price,
      ...extra,
    },
  };
}

export interface PurchaseResult {
  run: RunState;
  messages: string[];
}

export function buyOffer(run: RunState, offerId: string): PurchaseResult {
  const next = cloneRun(run);
  const shop = next.shop;
  if (!shop) throw new Error('Not in a shop');
  const offer = shop.offers.find((o) => o.id === offerId);
  if (!offer || offer.sold) throw new Error('Offer unavailable');
  if (next.ops.length) throw new Error('먼저 진행 중인 선택을 끝내세요');
  const price = currentPrice(next, offer);
  if (next.coins < price) throw new Error('엽전이 부족함');
  if (offer.service === 'talisman' && next.talismans.some((t) => t.id === offer.talismanId)) throw new Error('이미 보유한 부적');
  if (offer.service === 'removal' && next.deck.length <= next.rules.minDeckSize) throw new Error(`덱은 최소 ${next.rules.minDeckSize}장`);
  const messages: string[] = [];
  const ctx = makeContext(next, undefined, deriveRng(next.seed, 'shopctx'));
  const unsoldPrices = shop.offers.filter((o) => !o.sold).map((o) => currentPrice(next, o));
  const amplified = hasTalisman(ctx, 'gamblers-hand') && price >= Math.max(...unsoldPrices) && price > 0;
  next.coins -= price;
  if (!offer.repeatable) offer.sold = true;
  shop.purchasesHere++;
  next.purchases++;
  let steps = offerSteps(offer, price, amplified && (offer.service === 'upgrade' || offer.service === 'jokboTraining'));
  if (amplified && offer.service !== 'upgrade' && offer.service !== 'jokboTraining') {
    const refund = Math.ceil(price * 0.25);
    next.coins += refund;
    messages.push(`도박사의 손: 엽전 ${refund} 환급`);
    steps = steps.map((s) => (s.op === 'interactive' ? { ...s, operation: { ...s.operation, refund: (s.operation.refund ?? 0) - refund } } : s));
  } else if (amplified) {
    messages.push('도박사의 손: 효과 +1레벨');
  }
  if (offer.service === 'talisman') messages.push(`부적 획득: ${getTalismanDef(offer.talismanId!)?.name}`);
  runOutcomes(next, steps);
  messages.push(...emitRunEvent(next, { type: 'ITEM_PURCHASED', service: offer.service, price }));
  for (const m of messages) next.history.push({ stageIndex: next.stageIndex, text: m });
  return { run: next, messages };
}

export function rerollShop(run: RunState): RunState {
  const next = cloneRun(run);
  const shop = next.shop;
  if (!shop) throw new Error('Not in a shop');
  const price = rerollPrice(shop);
  if (next.coins < price) throw new Error('엽전이 부족함');
  next.coins -= price;
  shop.rerolls++;
  const removal = shop.offers.find((o) => o.service === 'removal');
  const fresh = generateOffers(next, shop.nodeIndex, shop.rerolls).filter((o) => o.service !== 'removal');
  shop.offers = [...(removal ? [removal] : []), ...fresh.map((o, i) => ({ ...o, id: `${o.id}-r${shop.rerolls}-${i}` }))];
  return next;
}
