import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  BALANCE,
  JOKBO_DEFS,
  opCandidates,
  opChoices,
  opNeedsCard,
  opNeedsChoice,
  previewOperation,
  resolveOperation,
  type CardView,
  type JokboId,
  type OperationInput,
  type RunState,
} from '../../game';
import type { GameApi } from '../hooks/useGame';
import { Card } from '../components/Card';
import { CardDetail } from '../components/CardDetail';
import { useCardHover } from '../components/Hover';
import { Modal, RARITY_STYLE } from '../components/Modal';
import { makeDeckViewFn } from '../views';
import { CardFilterBar, applyCardFilter, type FilterKey } from './DeckViewer';

function PowerLine({ v }: { v: CardView }): ReactElement {
  return (
    <div className="text-[11px] text-stone-300">
      Lv.{v.level} · 파워 {v.power} · {v.scoringMonths.join('/')}월
    </div>
  );
}

export function OperationModal({ game }: { game: GameApi }): ReactElement | null {
  const run = game.run!;
  const op = run.ops[0];
  const hover = useCardHover();
  const [picked, setPicked] = useState<string[]>([]);
  const [choice, setChoice] = useState<string | undefined>();
  const [filter, setFilter] = useState<FilterKey>('all');
  useEffect(() => {
    setPicked(op?.cardUid ? [op.cardUid] : []);
    setChoice(undefined);
  }, [op?.id, op?.cardUid]);
  const view = useMemo(() => makeDeckViewFn(run), [run]);
  if (!op) return null;

  const needCard = opNeedsCard(op);
  const need = needCard ? Math.max(1, op.count) : 0;
  const candidates = needCard ? opCandidates(run, op) : [];
  const cardsReady = !needCard || picked.length === need;
  const needChoice = opNeedsChoice(op);
  const choices = cardsReady && needChoice ? opChoices(run, op, picked[0]) : [];
  const ready = cardsReady && (!needChoice || !!choice);
  const input: OperationInput = {
    cardUids: needCard ? picked : undefined,
    choiceId: choice,
    jokboId: op.kind === 'upgradeJokbo' ? (choice as JokboId | undefined) : undefined,
  };
  const after: RunState | undefined = ready ? previewOperation(run, op.id, input) : undefined;
  const afterView = after ? makeDeckViewFn(after) : undefined;

  const toggle = (uid: string) => {
    if (op.cardUid) return;
    setChoice(undefined);
    setPicked((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : need === 1 ? [uid] : p.length < need ? [...p, uid] : p));
  };

  const shown = applyCardFilter(candidates, view, filter);
  const newCards = after ? after.deck.filter((c) => !run.deck.some((d) => d.uid === c.uid)) : [];

  return (
    <Modal wide>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-xl font-black text-amber-300">{op.title}</div>
          <div className="text-sm text-stone-300">{op.description}</div>
          {run.ops.length > 1 && <div className="text-xs text-stone-500">대기 중인 선택 {run.ops.length - 1}개 더</div>}
        </div>
        {op.cancellable && (
          <button type="button" className="btn btn-dark text-xs" onClick={() => game.act((r) => resolveOperation(r, op.id, { cancel: true }))}>
            취소{op.refund ? ` (엽전 ${op.refund} 환불)` : ''}
          </button>
        )}
      </div>

      {needCard && !op.cardUid && (
        <>
          <CardFilterBar value={filter} onChange={setFilter} />
          <div className="mb-1 text-xs text-stone-400">
            {need > 1 ? `${picked.length}/${need}장 선택` : '카드 한 장을 고르세요'} · 후보 {candidates.length}장
          </div>
          {candidates.length === 0 && <div className="text-sm text-red-300">고를 수 있는 카드가 없습니다.</div>}
          <div className="flex max-h-[38vh] flex-wrap gap-2 overflow-y-auto px-1 pb-2 pt-3 scrollbar-thin">
            {shown.map((u) => (
              <Card key={u} view={view(u)} size="md" selected={picked.includes(u)} onClick={() => toggle(u)} onHover={hover} />
            ))}
          </div>
        </>
      )}

      {choices.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-sm font-bold">선택지</div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!!c.disabled}
                className={`rounded-lg border bg-black/30 p-2 text-left text-sm transition hover:bg-white/10 ${RARITY_STYLE[c.rarity ?? 'common']} ${choice === c.id ? 'ring-2 ring-amber-400' : ''}`}
                onClick={() => setChoice(c.id)}
              >
                <div className="font-bold">{c.label}</div>
                <div className="text-xs text-stone-300">{c.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {after && (
        <div className="mt-3 rounded-lg border border-amber-300/30 bg-black/30 p-2">
          <div className="mb-1 text-sm font-bold text-amber-200">미리보기 (전 → 후)</div>
          <div className="flex flex-wrap gap-4">
            {picked.map((u) => {
              const before = view(u);
              const exists = after.deck.some((c) => c.uid === u);
              return (
                <div key={u} className="flex items-center gap-2">
                  <div className="text-center">
                    <Card view={before} size="md" onHover={hover} />
                    <PowerLine v={before} />
                  </div>
                  <span className="text-2xl text-amber-300">→</span>
                  {exists && afterView ? (
                    <div className="flex items-start gap-2">
                      <div className="text-center">
                        <Card view={afterView(u)} size="md" onHover={hover} />
                        <PowerLine v={afterView(u)} />
                      </div>
                      <div className="hidden max-w-xs md:block">
                        <CardDetail view={afterView(u)} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-300">덱에서 제거</div>
                  )}
                </div>
              );
            })}
            {newCards.map((c) => (
              <div key={c.uid} className="text-center">
                <div className="text-xs text-emerald-300">새 카드</div>
                <Card view={afterView!(c.uid)} size="md" onHover={hover} />
              </div>
            ))}
            {(op.kind === 'upgradeJokbo' || op.kind === 'chooseEvolution') && choice && (
              <JokboChange before={run} after={after} id={(op.jokboId ?? choice) as JokboId} />
            )}
          </div>
          <div className="mt-1 text-xs text-stone-400">
            덱 {run.deck.length}장 → {after.deck.length}장 · 엽전 {run.coins} → {after.coins}
          </div>
        </div>
      )}
      {ready && !after && <div className="mt-2 text-sm text-red-300">이 조합은 적용할 수 없습니다.</div>}

      <div className="mt-3 flex justify-end">
        <button type="button" className="btn btn-gold px-6" disabled={!ready || !after} onClick={() => game.act((r) => resolveOperation(r, op.id, input))}>
          확정
        </button>
      </div>
    </Modal>
  );
}

function JokboChange({ before, after, id }: { before: RunState; after: RunState; id: JokboId }): ReactElement | null {
  const a = before.jokbo[id];
  const b = after.jokbo[id];
  if (!a || !b) return null;
  return (
    <div className="text-sm">
      <div className="font-bold" style={{ color: JOKBO_DEFS[id].color }}>
        {JOKBO_DEFS[id].name}
      </div>
      <div>
        Lv.{a.level} → Lv.{b.level} · ×{BALANCE.jokboLevelMult(a.level).toFixed(2)} → ×{BALANCE.jokboLevelMult(b.level).toFixed(2)}
      </div>
      {b.evolutions.length > a.evolutions.length && <div className="text-cyan-300">진화 획득</div>}
    </div>
  );
}
