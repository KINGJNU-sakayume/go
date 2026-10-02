import { useEffect, useMemo, useState, type ReactElement } from 'react';
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
  type PpeokPile,
} from '../../game';
import type { GameApi } from '../hooks/useGame';
import { useChainAnimation } from '../hooks/useChainAnimation';
import { Card, CardBack } from '../components/Card';
import { useCardHover } from '../components/Hover';
import { Modal } from '../components/Modal';
import { CapturedPanel, GoStopRulesPanel, JokboPanel, MultiplierPanel, TalismanStrip } from '../panels/StagePanels';
import { ChainHistory, ChainSpotlight } from '../panels/ChainFeed';
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

  useEffect(() => {
    if (selected && !stage.hand.includes(selected)) setSelected(null);
  }, [stage.hand, selected]);

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

  const exCheck = selected && inPlay ? canExchange(run, selected) : undefined;
  const displayedScore = Math.max(0, stage.score - anim.pendingScore);
  const showResult = run.phase === 'stageResult' && !anim.busy;

  return (
    <div className="flex min-h-screen flex-col gap-2 p-2">
      <TopBar game={game} displayedScore={displayedScore} openDeck={openDeck} />
      <div className="grid flex-1 grid-cols-1 gap-2 lg:grid-cols-[13rem_1fr_17rem]">
        <div className="order-2 space-y-2 lg:order-1">
          <CapturedPanel run={run} view={view} />
          <div className="panel p-2 text-[11px] text-stone-300">
            <div className="mb-1 text-xs font-black tracking-widest text-amber-200">
              {def.month}월 규칙 {def.boss && <span className="text-red-400">· 보스</span>}
            </div>
            {def.ruleText.map((t, i) => (
              <div key={i}>• {t}</div>
            ))}
          </div>
          <GoStopRulesPanel />
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-2 lg:order-2">
          <div className="felt relative flex min-h-[300px] flex-1 flex-col rounded-2xl p-3" onClick={() => locked && anim.skip()}>
            <ChainSpotlight current={anim.current} shown={anim.shown} busy={anim.busy} onSkip={anim.skip} />
            <div className="flex flex-1 items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <CardBack count={stage.stock.length} />
                {previewN > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-sky-300">미리보기</span>
                    {stage.stock.slice(0, previewN).map((u) => (
                      <Card key={u} view={view(u)} size="sm" onHover={hover} />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-2">
                {(() => {
                  const fieldCard = (u: string) => {
                    const covered = stage.covered.includes(u);
                    const hl = pendingTargets.has(u) || (!covered && matchable.has(u));
                    return (
                      <Card
                        key={u}
                        view={view(u)}
                        covered={covered}
                        highlight={hl}
                        dim={!!selected && inPlay && !hl && !covered}
                        onClick={() => onFieldClick(u)}
                        onHover={covered ? undefined : hover}
                      />
                    );
                  };
                  const shown = new Set<PpeokPile>();
                  return stage.field.map((u) => {
                    const pile = pileOf.get(u);
                    if (!pile) return fieldCard(u);
                    if (shown.has(pile)) return null;
                    shown.add(pile);
                    return (
                      <div
                        key={`pile-${pile.uids.join('-')}`}
                        className="relative flex items-center rounded-lg bg-red-950/50 px-1.5 pb-1.5 pt-4 ring-1 ring-red-400/60"
                        title={`뻑: ${pile.month}월 세 장이 묶여 있습니다. 네 번째 ${pile.month}월 패로 한꺼번에 먹으면 자뻑 먹기 (보너스 + 피 뺏기).`}
                      >
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-700 px-1.5 text-[10px] font-black">
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
                {stage.field.length === 0 && <div className="text-sm text-emerald-200/60">필드가 비었습니다</div>}
              </div>
              {stage.phase === 'chooseStockTarget' && pending && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-amber-300">더미에서 나온 패</span>
                  <Card view={view(pending.cardUid)} size="lg" highlight onHover={hover} />
                </div>
              )}
            </div>
            {(stage.phase === 'chooseHandTarget' || stage.phase === 'chooseStockTarget') && (
              <div className="mt-2 text-center text-sm font-bold text-amber-200">
                {stage.phase === 'chooseStockTarget' ? '더미 패가 여러 장과 짝이 맞습니다 — 가져갈 카드를 고르세요' : '가져갈 필드 카드를 고르세요 (빛나는 카드)'}
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
              <div className="text-xs font-black tracking-widest text-amber-200">
                손패 {stage.hand.length}
                <span className="ml-2 font-normal text-stone-400">
                  {inPlay ? (selected ? '한 번 더 누르면 냄 · 빛나는 필드 카드를 누르면 그 카드를 가져감' : '낼 카드를 고르세요') : ''}
                </span>
                {selectedShake !== undefined && (
                  <span className="ml-2 font-bold text-pink-300">
                    이 패를 내면 흔들기! ({selectedShake}월 · 이후 점수 ×{nextShake})
                  </span>
                )}
                {stage.drunk > 0 && <span className="ml-2 text-orange-300">취기 {stage.drunk}/3</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {shakes.map((m) => (
                  <span
                    key={`shake-${m}`}
                    className="rounded border border-pink-400/50 bg-pink-950/50 px-1.5 py-1 text-xs font-bold text-pink-200"
                    title={`${m}월 패가 손에 세 장 이상, 바닥에는 없습니다. ${m}월 패를 내면 자동으로 흔들어 이번 판 이후 점수가 ×${BALANCE.shakeMult} (최대 ${BALANCE.shakeMaxStacks}번).`}
                  >
                    흔들기 대기 · {m}월
                  </span>
                ))}
                {bombs.map((b) => (
                  <button key={b.month} type="button" className="btn btn-red text-xs" disabled={locked} onClick={() => game.act((r) => playBomb(r, b.month))}>
                    폭탄! {b.month}월 ({b.handUids.length}+{b.fieldUids.length}장)
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-blue text-xs"
                  disabled={!exCheck?.ok || locked}
                  title={exCheck?.reason ?? '선택한 손패를 버리고 더미에서 한 장 뽑기'}
                  onClick={() => {
                    if (selected) game.act((r) => exchangeCard(r, selected));
                    setSelected(null);
                  }}
                >
                  교환 {exCheck?.free ? '(무료)' : ''} · 남은 {stage.exchangesLeft}
                </button>
                <button
                  type="button"
                  className="btn btn-gold text-xs"
                  disabled={!selected || !inPlay || locked}
                  onClick={() => selected && onHandClick(selected)}
                >
                  내기
                </button>
              </div>
            </div>
            <div className="flex min-h-[110px] flex-wrap items-end justify-center gap-2 pt-2">
              {stage.hand.map((u) => (
                <Card key={u} view={view(u)} size="lg" selected={selected === u} onClick={() => onHandClick(u)} onHover={hover} />
              ))}
            </div>
          </div>
        </div>

        <div className="order-3 space-y-2">
          <JokboPanel run={run} flash={lastJokbo} />
          <TalismanStrip run={run} compact />
          <MultiplierPanel run={run} />
          <ChainHistory run={run} />
        </div>
      </div>

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

      {run.phase === 'stage' && stage.phase === 'goStop' && !anim.busy && (
        <Modal>
          <div className="text-center">
            <div className="text-3xl font-black text-amber-300" style={{ fontFamily: 'var(--font-serif)' }}>
              {stage.goCount > 0 ? '또 넘었다!' : '목표 달성!'}
            </div>
            <div className="mt-1 text-sm text-stone-300">
              점수 {fmt(stage.score)} / {stage.goLine ? `고 기준선 ${fmt(stage.goLine)}` : `목표 ${fmt(stage.target)}`} · 남은 턴 {stage.turnsTotal - stage.turn}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button type="button" className="btn btn-gold py-4 text-left" onClick={() => game.act(chooseStop)}>
                <div className="text-2xl font-black">스톱</div>
                <div className="text-xs font-normal">지금 스테이지 클리어. 안전하게 보상을 받습니다.</div>
              </button>
              <button type="button" className="btn btn-red py-4 text-left" onClick={() => game.act(chooseGo)}>
                <div className="text-2xl font-black">{stage.goCount + 1}고!</div>
                <div className="text-xs font-normal">
                  남은 턴 계속. 엽전 +{Math.round((def.goHazard.coinBonusPerGo + (def.mechanics.goRewardBonus ?? 0)) * 100)}%/고, 보상 등급 상승. 새 기준선 {fmt(Math.round(stage.score * def.goHazard.lineMult))}.
                </div>
              </button>
            </div>
            <div className="mt-2 text-xs text-red-300">{def.goHazard.description}</div>
          </div>
        </Modal>
      )}

      {showResult && run.stageResult && (
        <Modal>
          <StageResultView game={game} />
        </Modal>
      )}
    </div>
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
