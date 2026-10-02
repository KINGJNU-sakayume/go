import { useMemo, useState, type ReactElement } from 'react';
import {
  ALL_JOKBO,
  JOKBO_DEFS,
  STAGES,
  advanceToNextStage,
  buildTitle,
  buyOffer,
  chooseCrossroads,
  chooseEventOption,
  currentPrice,
  getTalismanDef,
  pickReward,
  rerollPrice,
  rerollShop,
  skipReward,
  type RunState,
} from '../../game';
import type { GameApi } from '../hooks/useGame';
import { Card } from '../components/Card';
import { useCardHover } from '../components/Hover';
import { RARITY_KO, RARITY_STYLE } from '../components/Modal';
import { TalismanStrip } from '../panels/StagePanels';
import { TopBar, copyText } from '../panels/TopBar';
import { Seal } from '../components/Seal';

const SERVICE_SEAL: Record<string, string> = {
  removal: '削',
  upgrade: '昇',
  mutation: '變',
  duplicate: '複',
  perfectClone: '寫',
  jokboTraining: '譜',
  jokerWorkshop: '工',
  monthDye: '染',
  monthDyeExact: '筆',
  ribbonDye: '染',
  ribbonDyeExact: '彩',
  purify: '淨',
  enhancement: '強',
  addJoker: '鬼',
};
import { fmt, makeDeckViewFn } from '../views';

/** Reward kinds as carved seals (no emoji / generic glyph icons). */
const KIND_SEAL: Record<string, { char: string; tone: 'red' | 'ink' | 'gold' | 'indigo' }> = {
  talisman: { char: '符', tone: 'red' },
  upgradeCard: { char: '昇', tone: 'gold' },
  removeCard: { char: '削', tone: 'ink' },
  duplicateCard: { char: '複', tone: 'indigo' },
  perfectClone: { char: '寫', tone: 'indigo' },
  enhanceCard: { char: '強', tone: 'gold' },
  mutateCard: { char: '變', tone: 'red' },
  upgradeJokbo: { char: '譜', tone: 'red' },
  addJoker: { char: '鬼', tone: 'ink' },
  jokerWorkshop: { char: '工', tone: 'ink' },
  coins: { char: '錢', tone: 'gold' },
};

function Shell({ game, openDeck, children }: { game: GameApi; openDeck: () => void; children: React.ReactNode }): ReactElement {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-3 p-2">
      <TopBar game={game} openDeck={openDeck} />
      {children}
      <TalismanStrip run={game.run!} />
    </div>
  );
}

export function RewardScreen({ game, openDeck }: { game: GameApi; openDeck: () => void }): ReactElement {
  const run = game.run!;
  const reward = run.reward!;
  const def = STAGES[run.stageIndex];
  return (
    <Shell game={game} openDeck={openDeck}>
      <div className="text-center">
        <div className="text-3xl font-black text-amber-300" style={{ fontFamily: 'var(--font-serif)' }}>
          {reward.boss ? '보스 보상' : `${def.month}월 보상`}
        </div>
        <div className="text-sm text-stone-400">하나를 고르세요. 무엇을 고르느냐가 빌드를 만듭니다.</div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {reward.options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`panel flex flex-col gap-2 border-2 p-4 text-left transition hover:-translate-y-1 hover:bg-white/5 ${RARITY_STYLE[o.rarity]}`}
            onClick={() => game.act((r) => pickReward(r, o.id))}
          >
            <div className="flex items-center justify-between">
              <Seal char={KIND_SEAL[o.kind]?.char ?? '賞'} tone={KIND_SEAL[o.kind]?.tone ?? 'red'} size={40} />
              <span className="text-xs">{RARITY_KO[o.rarity]}</span>
            </div>
            <div className="text-lg font-black text-stone-100">{o.title}</div>
            <div className="text-sm text-stone-300">{o.description}</div>
            {o.preview && <div className="rounded bg-black/40 p-1.5 text-xs text-amber-200">{o.preview}</div>}
          </button>
        ))}
      </div>
      <div className="text-center">
        <button type="button" className="btn btn-dark text-xs" onClick={() => game.act(skipReward)}>
          건너뛰기 (엽전 +3)
        </button>
      </div>
    </Shell>
  );
}

export function CrossroadsScreen({ game, openDeck }: { game: GameApi; openDeck: () => void }): ReactElement {
  const run = game.run!;
  const next = STAGES[run.stageIndex + 1];
  return (
    <Shell game={game} openDeck={openDeck}>
      <div className="text-center">
        <div className="text-3xl font-black text-amber-300" style={{ fontFamily: 'var(--font-serif)' }}>
          갈림길
        </div>
        <div className="text-sm text-stone-400">
          다음: {next.month}월 {next.name} {next.boss ? '(보스)' : ''} — 목표 {fmt(next.target)}. {next.ruleText.join(' ')}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {run.crossroads!.options.map((o) => (
          <button key={o.id} type="button" className="panel p-6 text-left transition hover:-translate-y-1 hover:bg-white/5" onClick={() => game.act((r) => chooseCrossroads(r, o.id))}>
            <Seal char={o.kind === 'shop' ? '市' : '緣'} tone={o.kind === 'shop' ? 'gold' : 'red'} size={48} />
            <div className="mt-2 text-2xl font-black">{o.title}</div>
            <div className="text-sm text-stone-300">{o.description}</div>
          </button>
        ))}
      </div>
    </Shell>
  );
}

export function ShopScreen({ game, openDeck }: { game: GameApi; openDeck: () => void }): ReactElement {
  const run = game.run!;
  const shop = run.shop!;
  return (
    <Shell game={game} openDeck={openDeck}>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-black text-amber-300" style={{ fontFamily: 'var(--font-serif)' }}>
            장터
          </div>
          <div className="text-sm text-stone-400">엽전 {run.coins} · 덱 {run.deck.length}장 (최소 {run.rules.minDeckSize})</div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-dark" disabled={run.coins < rerollPrice(shop)} onClick={() => game.act(rerollShop)}>
            새로고침 ({rerollPrice(shop)})
          </button>
          <button type="button" className="btn btn-gold" disabled={run.ops.length > 0} onClick={() => game.act(advanceToNextStage)}>
            떠나기 → {STAGES[run.stageIndex + 1]?.month}월
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shop.offers.map((o) => {
          const price = currentPrice(run, o);
          const t = o.talismanId ? getTalismanDef(o.talismanId) : undefined;
          return (
            <div key={o.id} className={`panel flex flex-col gap-1 border-2 p-3 ${RARITY_STYLE[o.rarity]} ${o.sold ? 'opacity-40' : ''}`}>
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Seal char={t ? t.glyph : SERVICE_SEAL[o.service] ?? '市'} size={22} tone={t ? 'red' : 'ink'} />
                  {t ? `부적 #${t.number}` : '장터 서비스'}
                </span>
                <span>{RARITY_KO[o.rarity]}</span>
              </div>
              <div className="font-black text-stone-100">{o.title}</div>
              <div className="flex-1 text-xs text-stone-300">{o.description}</div>
              {o.preview && <div className="text-xs text-amber-200">{o.preview}</div>}
              <button
                type="button"
                className="btn btn-gold mt-1"
                disabled={o.sold || run.coins < price || run.ops.length > 0}
                onClick={() =>
                  game.act((r) => {
                    const res = buyOffer(r, o.id);
                    res.messages.forEach((m) => game.toast(m));
                    return res.run;
                  })
                }
              >
                {o.sold ? '판매됨' : `${price} 엽전`}
                {o.repeatable && !o.sold ? ' · 반복 가능' : ''}
              </button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export function EventScreen({ game, openDeck }: { game: GameApi; openDeck: () => void }): ReactElement {
  const run = game.run!;
  const ev = run.event!;
  const view = useMemo(() => makeDeckViewFn(run), [run]);
  const hover = useCardHover();
  return (
    <Shell game={game} openDeck={openDeck}>
      <div className="panel p-5">
        <div className="text-3xl font-black text-amber-300" style={{ fontFamily: 'var(--font-serif)' }}>
          {ev.title}
        </div>
        <div className="mt-2 text-stone-200">{ev.text}</div>
        {ev.shownCards.length > 0 && (
          <div className="mt-3 flex gap-2">
            {ev.shownCards.filter((u) => run.deck.some((c) => c.uid === u)).map((u) => (
              <Card key={u} view={view(u)} size="md" onHover={hover} />
            ))}
          </div>
        )}
        {!ev.resolved ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {ev.choices.map((c) => {
              const concealed = c.concealed && !ev.revealed.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!!c.disabled || run.ops.length > 0 || (c.cost ?? 0) > run.coins}
                  className="rounded-lg border border-amber-200/20 bg-black/30 p-3 text-left transition hover:bg-white/10 disabled:opacity-40"
                  onClick={() => game.act((r) => chooseEventOption(r, c.id))}
                >
                  <div className="font-bold">{concealed ? c.label.split(':')[0] + ': ???' : c.label}</div>
                  <div className="text-xs text-stone-300">{concealed ? '내용을 알 수 없다.' : c.description}</div>
                  <div className="mt-1 flex gap-2 text-xs">
                    {c.cost ? <span className="text-amber-300">엽전 {c.cost}</span> : null}
                    {c.probability !== undefined && <span className="text-sky-300">확률 {Math.round(c.probability * 100)}%</span>}
                    {c.disabled && <span className="text-red-300">{c.disabled}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <div className="text-emerald-300">{ev.resultText}</div>
            <div className="mt-2 max-h-28 overflow-y-auto text-xs text-stone-400 scrollbar-thin">
              {run.history.slice(-6).map((h, i) => (
                <div key={i}>• {h.text}</div>
              ))}
            </div>
            <button type="button" className="btn btn-gold mt-3" disabled={run.ops.length > 0} onClick={() => game.act(advanceToNextStage)}>
              계속 → {STAGES[run.stageIndex + 1]?.month}월
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

export function GameOverScreen({ game, openDeck }: { game: GameApi; openDeck: () => void }): ReactElement {
  const run = game.run!;
  const s = run.stats;
  const title = buildTitle(run);
  const view = useMemo(() => makeDeckViewFn(run), [run]);
  const hover = useCardHover();
  const won = run.phase === 'victory';
  const mostJokbo = ALL_JOKBO.reduce<{ id?: string; n: number }>((b, j) => ((s.jokboTriggers[j] ?? 0) > b.n ? { id: j, n: s.jokboTriggers[j] ?? 0 } : b), { n: 0 });
  const topCard = [...run.deck].sort((a, b) => b.level - a.level)[0];
  const rows: [string, string | number][] = [
    ['시드', run.seed],
    ['총 점수', fmt(s.totalScore)],
    ['최고 단일 연쇄', `${fmt(s.highestChainScore)} (${s.highestChainTitle || '-'})`],
    ['최장 연쇄', `${s.longestChain}회 발동`],
    ['최고 단일 득점', fmt(s.highestEventScore)],
    ['제거한 카드', s.cardsRemoved],
    ['복제한 카드', s.cardsDuplicated],
    ['최종 덱', `${run.deck.length}장`],
    ['가장 많이 발동한 족보', mostJokbo.id ? `${JOKBO_DEFS[mostJokbo.id as 'pi'].name} (${mostJokbo.n}회)` : '-'],
    ['최고 레벨 카드', topCard ? `${view(topCard.uid).name} Lv.${topCard.level}` : '-'],
    ['획득한 부적', s.talismansObtained.length],
    ['쓰러뜨린 보스', s.bossesDefeated],
    ['고 선언', `${s.goDecisions}회 (독박 ${s.goBusts})`],
    ['과열 (무한 연쇄 차단)', s.overflowCount],
  ];
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-3 p-3">
      <div className="panel p-6 text-center">
        <div className={`text-5xl font-black ${won ? 'text-amber-300' : 'text-red-400'}`} style={{ fontFamily: 'var(--font-serif)' }}>
          {won ? '한 해를 이겨냈다' : `${STAGES[run.stageIndex].month}월에 무너졌다`}
        </div>
        <div className="mt-3 text-sm text-stone-400">이번 런의 이름</div>
        <div className="text-3xl font-black text-fuchsia-300" style={{ fontFamily: 'var(--font-serif)' }}>
          「{title.title}」
        </div>
        <div className="text-xs text-stone-500">객관적 기록으로 지은 이름일 뿐, 평가가 아닙니다.</div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-gold" onClick={() => game.startNew()}>
            새 런
          </button>
          <button type="button" className="btn btn-red" onClick={() => game.startNew(run.seed)}>
            같은 시드로 재도전
          </button>
          <button type="button" className="btn btn-dark" onClick={() => copyText(run.seed, game)}>
            시드 복사
          </button>
          <button type="button" className="btn btn-dark" onClick={openDeck}>
            덱 통계
          </button>
          <button type="button" className="btn btn-dark" onClick={game.quitToTitle}>
            타이틀
          </button>
        </div>
      </div>
      <div className="panel grid gap-x-6 gap-y-1 p-4 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-white/5 py-0.5">
            <span className="text-stone-400">{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <TalismanStrip run={run} />
      <div className="panel p-3">
        <div className="mb-2 text-sm font-black text-amber-200">최종 덱 — "이건 더 이상 합법적인 화투가 아니다."</div>
        <div className="flex flex-wrap gap-1.5">
          {[...run.deck]
            .sort((a, b) => (view(a.uid).printedMonth ?? 13) - (view(b.uid).printedMonth ?? 13))
            .map((c) => (
              <Card key={c.uid} view={view(c.uid)} size="sm" onHover={hover} />
            ))}
        </div>
      </div>
    </div>
  );
}

export function TitleScreen({ game }: { game: GameApi }): ReactElement {
  const [seed, setSeed] = useState('');
  const meta = game.saveMeta;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="panel w-full max-w-lg p-8 text-center">
        <div className="text-6xl font-black text-red-500" style={{ fontFamily: 'var(--font-serif)' }}>
          花鬪
        </div>
        <div className="mt-1 text-3xl font-black" style={{ fontFamily: 'var(--font-serif)' }}>
          화투 로그라이크
        </div>
        <div className="mt-2 text-sm text-stone-400">
          거의 평범한 화투 한 벌로 시작해, 지우고·복제하고·변이시켜 족보가 끝없이 터지는 부서진 엔진을 만드세요. 1월부터 12월까지, 한 해를 버티면 승리.
        </div>
        <div className="mt-6 space-y-2">
          {meta && (
            <button type="button" className="btn btn-gold w-full py-3 text-lg" onClick={game.continueSave}>
              이어하기 · {STAGES[meta.stageIndex]?.month}월 ({meta.seed})
            </button>
          )}
          <button type="button" className="btn btn-red w-full py-3 text-lg" onClick={() => game.startNew(seed || undefined)}>
            새 런
          </button>
          <input
            className="w-full rounded bg-black/40 px-3 py-2 text-center text-sm"
            placeholder="시드 입력 (선택) 예: HWATU-7K2M9A"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
          {meta && (
            <button
              type="button"
              className="btn btn-dark w-full text-xs"
              onClick={() => {
                if (confirm('저장된 런을 삭제할까요?')) game.deleteSaveFile();
              }}
            >
              저장 삭제
            </button>
          )}
        </div>
        <div className="mt-6 text-left text-xs text-stone-500">
          <b className="text-stone-300">조작</b>: 손패를 눌러 고르고 한 번 더 누르면 냅니다. 빛나는 필드 카드를 누르면 그 카드를 가져갑니다. 카드에 마우스를 올리면 모든 규칙이 설명됩니다. 교환으로 손패를 바꾸고, 목표를 넘으면 고/스톱을 고르세요.
        </div>
      </div>
    </div>
  );
}

export function isRunScreenPhase(run: RunState): boolean {
  return ['reward', 'crossroads', 'shop', 'event'].includes(run.phase);
}
