import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  STAGES,
  Rng,
  bombOptions,
  canExchange,
  chooseExchange,
  chooseGo,
  chooseStop,
  chooseTarget,
  continueAfterStage,
  exchangeCard,
  handCaptureOptions,
  makeContext,
  matchableFieldCards,
  playBomb,
  playCard,
  cancelHandChoice,
  shakeFactor,
  shakeableMonths,
  identityOf,
  visiblePreviewCount,
  BALANCE,
  type CaptureOption,
  type JokboId,
  type Month,
  type PpeokPile,
} from '../../game';
import type { GameApi } from '../hooks/useGame';
import { useChainAnimation } from '../hooks/useChainAnimation';
import { useFlip } from '../hooks/useFlip';
import { playDrum, playTak } from '../audio';
import { Card, CardBack } from '../components/Card';
import { useCardHover } from '../components/Hover';
import { Modal } from '../components/Modal';
import { ScoreBoard } from '../components/ScoreBoard';
import { TalismanRow } from '../components/Talismans';
import { CapturedPiles, JokboLedger, RulesContent } from '../panels/StagePanels';
import { ChainCallout, ChainHistory } from '../panels/ChainFeed';
import { TopBar } from '../panels/TopBar';
import { fmt, makeViewFn } from '../views';

export function StageScreen({ game, openDeck }: { game: GameApi; openDeck: () => void }): ReactElement | null {
  const run = game.run!;
  const stage = run.stage!;
  const def = STAGES[stage.stageIndex];
  const view = useMemo(() => makeViewFn(run), [run]);
  const hover = useCardHover();
  const anim = useChainAnimation(run, game.settings.animSpeed);
  const [selected, setSelected] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sound = game.settings.sound;

  useEffect(() => {
    if (selected && !stage.hand.includes(selected)) setSelected(null);
  }, [stage.hand, selected]);

  // cards glide between hand, field and the captured piles; a capture lands with a "탁"
  useFlip(rootRef, [stage.hand, stage.field, stage.captured, stage.stock.length, game.settings.cardTheme], {
    enabled: game.settings.animSpeed !== 'instant',
    onCapture: (n) => sound && playTak(Math.min(1, 0.4 + n / 6)),
  });
  useEffect(() => {
    if (sound && anim.current?.step.kind === 'jokbo') playDrum();
  }, [anim.current, sound]);

  const ctx = useMemo(() => makeContext(run, stage, new Rng(stage.rng)), [run, stage]);
  const inPlay = run.phase === 'stage' && stage.phase === 'play';
  const locked = anim.busy && game.settings.animSpeed !== 'instant';
  const options: CaptureOption[] = useMemo(() => (selected && inPlay ? handCaptureOptions(run, selected) : []), [run, selected, inPlay]);
  const matchable = useMemo(() => new Set(selected && inPlay ? matchableFieldCards(ctx, selected) : []), [ctx, selected, inPlay]);
  const pending = stage.pending;
  const pendingTargets = new Set(
    (stage.phase === 'chooseHandTarget' || stage.phase === 'chooseStockTarget') && pending ? pending.options.flatMap((o) => o.targetUids) : [],
  );
  const bombs = inPlay ? bombOptions(run) : [];
  const shakes = inPlay ? shakeableMonths(run) : [];
  const selectedShake =
    selected && inPlay && shakes.length ? identityOf(ctx, selected).scoringMonths.find((m) => shakes.includes(m)) : undefined;
  const nextShake = shakeFactor((stage.shakeCount ?? 0) + 1);
  const pileOf = new Map<string, PpeokPile>();
  for (const p of stage.ppeokPiles ?? []) for (const u of p.uids) pileOf.set(u, p);
  const previewN = visiblePreviewCount(run);
  const lastJokbo = anim.current?.step.jokboId as JokboId | undefined;
  const frozen = (u: string) => (stage.temp[u]?.frozenUntil ?? -1) >= stage.turn;

  const onHandClick = (uid: string) => {
    if (locked) return anim.skip();
    if (stage.phase === 'chooseHandTarget') {
      game.act(cancelHandChoice);
      setSelected(uid);
      return;
    }
    if (!inPlay) return;
    if (selected !== uid) {
      setSelected(uid);
      return;
    }
    const opts = handCaptureOptions(run, uid);
    if (opts.length === 1) {
      game.act((r) => playCard(r, uid));
      setSelected(null);
    } else game.act((r) => playCard(r, uid));
  };

  const onFieldClick = (uid: string) => {
    if (locked) return anim.skip();
    if ((stage.phase === 'chooseHandTarget' || stage.phase === 'chooseStockTarget') && pending) {
      const opt = pending.options.find((o) => o.targetUids.includes(uid));
      if (opt) game.act((r) => chooseTarget(r, opt.id));
      return;
    }
    if (inPlay && selected && matchable.has(uid)) {
      const opt = options.find((o) => o.targetUids.includes(uid));
      if (opt) {
        game.act((r) => playCard(r, selected, opt.id));
        setSelected(null);
      }
    }
  };

  /** 흔들기: declare the shake while playing the selected card of that month (or first pick one). */
  const onShake = (m: Month) => {
    if (locked) return anim.skip();
    if (!inPlay) return;
    const ofMonth = stage.hand.filter((u) => {
      const id = identityOf(ctx, u);
      return !id.joker && id.scoringMonths.includes(m);
    });
    if (!ofMonth.length) return;
    const uid = selected && ofMonth.includes(selected) ? selected : undefined;
    if (!uid) {
      setSelected(ofMonth[0]);
      return;
    }
    game.act((r) => playCard(r, uid, undefined, { shake: true }));
    setSelected(null);
  };

  const exCheck = selected && inPlay ? canExchange(run, selected) : undefined;
  const displayedScore = Math.max(0, stage.score - anim.pendingScore);
  const showResult = run.phase === 'stageResult' && !anim.busy;

  const fieldCard = (u: string) => {
    const covered = stage.covered.includes(u);
    const hl = pendingTargets.has(u) || (!covered && matchable.has(u));
    return (
      <Card
        key={u}
        view={view(u)}
        covered={covered}
        frozen={frozen(u)}
        highlight={hl}
        dim={!!selected && inPlay && !hl && !covered}
        onClick={() => onFieldClick(u)}
        onHover={covered ? undefined : hover}
        flipId={u}
        flipZone="field"
      />
    );
  };

  return (
    <div ref={rootRef} className="flex min-h-screen flex-col gap-2 p-2">
      <TopBar game={game} openDeck={openDeck} openRules={() => setRulesOpen(true)} />
      <div className="grid flex-1 grid-cols-1 gap-2 lg:grid-cols-[15rem_1fr_17rem]">
        <div className="order-2 space-y-2 lg:order-1">
          <CapturedPiles run={run} view={view} />
          <button type="button" className="panel block w-full p-2 text-left text-xs text-stone-300 hover:bg-white/5" onClick={() => setRulesOpen(true)}>
            <div className="section-title mb-1">
              {def.month}월 규칙{def.boss ? ' · 보스' : ''}
            </div>
            {def.ruleText.map((t, i) => (
              <p key={i} className="leading-snug">
                {t}
              </p>
            ))}
            {(stage.ppeokCount ?? 0) > 0 && <p className="mt-1 text-red-300">이번 판 뻑 {stage.ppeokCount}회</p>}
            <p className="mt-1 text-stone-500">눌러서 전체 규칙 보기</p>
          </button>
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-2 lg:order-2">
          <ScoreBoard run={run} displayedScore={displayedScore} current={anim.current} />
          <TalismanRow run={run} current={anim.current} />

          <div className="felt relative flex min-h-[320px] flex-1 flex-col rounded-xl p-3" onClick={() => locked && anim.skip()}>
            <ChainCallout current={anim.current} shown={anim.shown} busy={anim.busy} />
            <div className="flex flex-1 items-center gap-4 pt-16">
              <div className="flex flex-col items-center gap-2">
                <CardBack count={stage.stock.length} flipId="stock" />
                {previewN > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-sky-200">다음 패</span>
                    {stage.stock.slice(0, previewN).map((u) => (
                      <Card key={u} view={view(u)} size="sm" onHover={hover} flipId={u} flipZone="other" />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-2.5">
                {(() => {
                  const shownPiles = new Set<PpeokPile>();
                  return stage.field.map((u) => {
                    const pile = pileOf.get(u);
                    if (!pile) return fieldCard(u);
                    if (shownPiles.has(pile)) return null;
                    shownPiles.add(pile);
                    return (
                      <div
                        key={`pile-${pile.uids.join('-')}`}
                        className="relative flex items-center rounded-lg bg-red-950/50 px-1.5 pb-1.5 pt-4 ring-1 ring-red-400/60"
                        title={`뻑: ${pile.month}월 세 장이 묶여 있습니다. 네 번째 ${pile.month}월 패로 한꺼번에 먹으면 자뻑 먹기 (보너스 + 피 뺏기).`}
                      >
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[#b8261c] px-1.5 text-xs font-black">
                          뻑 · {pile.month}월
                        </span>
                        {pile.uids
                          .filter((pu) => stage.field.includes(pu))
                          .map((pu, i) => (
                            <div key={pu} style={{ marginLeft: i ? -36 : 0 }}>
                              {fieldCard(pu)}
                            </div>
                          ))}
                      </div>
                    );
                  });
                })()}
                {stage.field.length === 0 && <div className="text-sm text-emerald-100/60">바닥이 비었습니다</div>}
              </div>
              {stage.phase === 'chooseStockTarget' && pending && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-amber-200">더미에서 나온 패</span>
                  <Card view={view(pending.cardUid)} size="lg" highlight onHover={hover} flipId={pending.cardUid} flipZone="field" />
                </div>
              )}
            </div>
            {(stage.phase === 'chooseHandTarget' || stage.phase === 'chooseStockTarget') && (
              <div className="mt-2 text-center text-sm font-bold text-amber-100">
                {stage.phase === 'chooseStockTarget' ? '뒤집은 패가 여러 장과 짝이 맞습니다 — 가져갈 카드를 고르세요' : '가져갈 바닥 패를 고르세요 (빛나는 카드)'}
                {stage.phase === 'chooseHandTarget' && (
                  <button type="button" className="btn btn-dark ml-2 text-xs" onClick={() => game.act(cancelHandChoice)}>
                    취소
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="panel p-2">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="section-title">손패 {stage.hand.length}</span>
                <span className="text-xs text-stone-400">
                  {inPlay ? (selected ? '한 번 더 누르면 냄 · 빛나는 바닥 패를 누르면 그 패를 가져감' : '낼 패를 고르세요') : ''}
                </span>
                {selectedShake !== undefined && (
                  <span className="text-xs font-bold text-[#ffb4a4]">
                    [흔들고 내기]로 내면 흔들기 — {selectedShake}월 · 이후 점수 ×{nextShake}
                  </span>
                )}
                {stage.drunk > 0 && <span className="text-xs text-orange-300">취기 {stage.drunk}/3</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedShake !== undefined ? (
                  <button
                    type="button"
                    className="btn btn-pink text-xs"
                    disabled={locked}
                    title={`${selectedShake}월 패를 내면서 흔들면 이후 얻는 점수가 ×${BALANCE.shakeMult} (최대 ${BALANCE.shakeMaxStacks}번). 그냥 [내기]로 내면 흔들지 않습니다.`}
                    onClick={() => onShake(selectedShake)}
                  >
                    흔들고 내기 ×{nextShake}
                  </button>
                ) : (
                  shakes.map((m) => (
                    <button key={`shake-${m}`} type="button" className="btn btn-pink text-xs" disabled={locked} onClick={() => onShake(m)} title="흔들 수 있는 달의 패를 고릅니다">
                      흔들 수 있음: {m}월
                    </button>
                  ))
                )}
                {bombs.map((b) => (
                  <button key={b.month} type="button" className="btn btn-red text-xs" disabled={locked} onClick={() => game.act((r) => playBomb(r, b.month))}>
                    폭탄 {b.month}월 ({b.handUids.length}+{b.fieldUids.length}장)
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-blue text-xs"
                  disabled={!exCheck?.ok || locked}
                  title={exCheck?.reason ?? '고른 손패를 버리고 더미에서 한 장 뽑기'}
                  onClick={() => {
                    if (selected) game.act((r) => exchangeCard(r, selected));
                    setSelected(null);
                  }}
                >
                  교환{exCheck?.free ? ' (무료)' : ''} · {stage.exchangesLeft}
                </button>
                <button type="button" className="btn btn-gold text-xs" disabled={!selected || !inPlay || locked} onClick={() => selected && onHandClick(selected)}>
                  내기
                </button>
              </div>
            </div>
            <div className="flex min-h-[132px] flex-wrap items-end justify-center gap-2 pt-2">
              {stage.hand.map((u) => (
                <Card key={u} view={view(u)} size="lg" selected={selected === u} onClick={() => onHandClick(u)} onHover={hover} flipId={u} flipZone="hand" />
              ))}
            </div>
          </div>
        </div>

        <div className="order-3 space-y-2">
          <JokboLedger run={run} flash={lastJokbo} />
          <ChainHistory run={run} />
        </div>
      </div>

      {rulesOpen && (
        <Modal onClose={() => setRulesOpen(false)}>
          <RulesContent run={run} />
          <div className="mt-4 text-right">
            <button type="button" className="btn btn-gold" onClick={() => setRulesOpen(false)}>
              닫기
            </button>
          </div>
        </Modal>
      )}

      {stage.phase === 'chooseExchange' && pending?.candidates && (
        <Modal>
          <div className="mb-2 text-lg font-black">행운: 두 장 중 하나를 고르세요</div>
          <div className="flex justify-center gap-4">
            {pending.candidates.map((u) => (
              <Card key={u} view={view(u)} size="lg" onHover={hover} onClick={() => game.act((r) => chooseExchange(r, u))} />
            ))}
          </div>
          <div className="mt-2 text-xs text-stone-400">고르지 않은 카드는 더미 맨 아래로 갑니다.</div>
        </Modal>
      )}

      {run.phase === 'stage' && stage.phase === 'goStop' && !anim.busy && <GoStopModal game={game} />}

      {showResult && run.stageResult && (
        <Modal>
          <StageResultView game={game} />
        </Modal>
      )}
    </div>
  );
}

function GoStopModal({ game }: { game: GameApi }): ReactElement {
  const run = game.run!;
  const stage = run.stage!;
  const def = STAGES[stage.stageIndex];
  const newLine = Math.round(stage.score * def.goHazard.lineMult);
  const left = stage.turnsTotal - stage.turn;
  const coinPct = Math.round((def.goHazard.coinBonusPerGo + (def.mechanics.goRewardBonus ?? 0)) * 100);
  const bae = (stage.goCount + 1) * BALANCE.goMultAdd;
  return (
    <Modal>
      <div className="text-center">
        <div className="text-3xl font-black text-amber-300" style={{ fontFamily: 'var(--font-serif)' }}>
          {stage.goCount > 0 ? '또 넘었다!' : '목표 달성!'}
        </div>
        <div className="mx-auto mt-2 grid max-w-md grid-cols-2 gap-x-6 gap-y-0.5 text-left text-sm">
          <span className="text-stone-400">지금 점수</span>
          <b className="text-right">{fmt(stage.score)}</b>
          <span className="text-stone-400">남은 턴</span>
          <b className="text-right">{left}턴</b>
          <span className="text-stone-400">고 하면 새 기준선</span>
          <b className="text-right text-red-300">
            {fmt(newLine)} (+{fmt(newLine - stage.score)} 필요)
          </b>
          <span className="text-stone-400">고 하면 이후 점수</span>
          <b className="text-right">배 +{bae}</b>
          <span className="text-stone-400">엽전 보상</span>
          <b className="text-right">+{coinPct}% / 고</b>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button type="button" className="btn btn-gold py-4 text-left" onClick={() => game.act(chooseStop)}>
            <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-serif)' }}>
              스톱
            </div>
            <div className="text-xs font-normal">여기서 클리어. 안전하게 보상을 받습니다.</div>
          </button>
          <button type="button" className="btn btn-red py-4 text-left" onClick={() => game.act(chooseGo)}>
            <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-serif)' }}>
              {stage.goCount + 1}고!
            </div>
            <div className="text-xs font-normal">
              남은 {left}턴 동안 계속. 기준선 {fmt(newLine)}에 못 미치면 독박.
            </div>
          </button>
        </div>
        <div className="mt-2 text-xs text-red-300">{def.goHazard.description}</div>
      </div>
    </Modal>
  );
}

function StageResultView({ game }: { game: GameApi }): ReactElement {
  const run = game.run!;
  const r = run.stageResult!;
  const def = STAGES[r.stageIndex];
  return (
    <div className="text-center">
      <div className={`text-4xl font-black ${r.cleared ? 'text-amber-300' : 'text-red-400'}`} style={{ fontFamily: 'var(--font-serif)' }}>
        {r.cleared ? (r.bust ? '독박… 하지만 클리어' : def.boss ? '보스 격파!' : '클리어!') : '패배'}
      </div>
      <div className="mt-1 text-stone-300">
        {def.month}월 {def.name} · {fmt(r.score)} / {fmt(r.target)}
        {r.cleared && r.score > r.target && <span className="ml-1 text-emerald-300">(초과 {Math.round(((r.score - r.target) / r.target) * 100)}%)</span>}
      </div>
      {r.cleared && (
        <div className="mx-auto mt-3 max-w-xs space-y-0.5 text-sm">
          <Row k="기본 엽전" v={r.coins.base} />
          <Row k="초과 점수" v={r.coins.overkill} />
          {r.goCount > 0 && <Row k={`${r.goCount}고`} v={r.coins.go} />}
          {r.coins.talismans !== 0 && <Row k="스테이지 중 획득" v={r.coins.talismans} note="(이미 지급)" />}
          {r.bust && <Row k="독박 손실" v={-r.coins.bustPenalty} />}
          <div className="flex justify-between border-t border-white/10 pt-1 font-black text-amber-300">
            <span>획득</span>
            <span>+{r.coins.total}</span>
          </div>
        </div>
      )}
      <div className="mt-2 text-xs text-stone-400">
        최고 연쇄 +{fmt(r.bestChain)} · 최장 연쇄 {r.longestChain}회 발동
      </div>
      <button type="button" className="btn btn-gold mt-4 px-8 py-3 text-lg" onClick={() => game.act(continueAfterStage)}>
        {r.cleared ? (def.finalBoss ? '한 해를 마무리' : '보상 받기') : '결과 보기'}
      </button>
    </div>
  );
}

function Row({ k, v, note }: { k: string; v: number; note?: string }): ReactElement {
  return (
    <div className="flex justify-between">
      <span className="text-stone-400">
        {k} {note}
      </span>
      <span>{v >= 0 ? `+${v}` : v}</span>
    </div>
  );
}
