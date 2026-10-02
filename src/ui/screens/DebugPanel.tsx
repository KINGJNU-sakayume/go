import { useState, type ReactElement } from 'react';
import {
  ALL_CARD_DEFINITIONS,
  ALL_JOKBO,
  STAGES,
  addCard,
  allTalismans,
  cloneRun,
  createStage,
  gainTalisman,
  generateReward,
  removeCardFromDeck,
  pushOp,
  type RunState,
} from '../../game';
import type { GameApi } from '../hooks/useGame';

/** Development tool for reproducing interaction bugs. Hidden in production unless `?debug` is in the URL. */
export function DebugPanel({ game }: { game: GameApi }): ReactElement {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState('');
  const [defId, setDefId] = useState('m09-ribbon');
  const [tal, setTal] = useState(allTalismans()[0].id);
  const [jokbo, setJokbo] = useState<string>('cheongdan');
  const [uid, setUid] = useState('');
  const [stageIdx, setStageIdx] = useState(0);
  const run = game.run;
  const mut = (fn: (r: RunState) => void) =>
    game.act((r) => {
      const n = cloneRun(r);
      fn(n);
      return n;
    });
  if (!open)
    return (
      <button type="button" className="fixed bottom-2 left-2 z-[90] rounded bg-fuchsia-700 px-2 py-1 text-xs font-bold" onClick={() => setOpen(true)}>
        디버그
      </button>
    );
  const lastChain = run?.stage?.chains[run.stage.chains.length - 1];
  return (
    <div className="fixed bottom-2 left-2 z-[90] max-h-[80vh] w-80 space-y-1.5 overflow-y-auto rounded-lg border border-fuchsia-500 bg-stone-950/95 p-2 text-xs shadow-2xl scrollbar-thin">
      <div className="flex justify-between font-black text-fuchsia-300">
        디버그
        <button type="button" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
      <div className="flex gap-1">
        <input className="flex-1 rounded bg-black px-1" placeholder="시드" value={seed} onChange={(e) => setSeed(e.target.value)} />
        <button type="button" className="btn btn-dark py-0.5 text-xs" onClick={() => game.startNew(seed || undefined)}>
          새 런
        </button>
      </div>
      {run && (
        <>
          <button type="button" className="btn btn-dark w-full py-0.5 text-xs" onClick={() => mut((r) => void (r.coins += 50))}>
            엽전 +50
          </button>
          <div className="flex gap-1">
            <select className="flex-1 rounded bg-black" value={defId} onChange={(e) => setDefId(e.target.value)}>
              {ALL_CARD_DEFINITIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} {d.nameKo}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-dark py-0.5 text-xs" onClick={() => mut((r) => void addCard(r, defId, { origin: 'debug' }))}>
              카드 추가
            </button>
          </div>
          <div className="flex gap-1">
            <select className="flex-1 rounded bg-black" value={uid} onChange={(e) => setUid(e.target.value)}>
              <option value="">카드 선택</option>
              {run.deck.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.uid} {c.defId} Lv{c.level}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-dark py-0.5 text-xs" disabled={!uid} onClick={() => mut((r) => void (r.deck.find((c) => c.uid === uid)!.level += 1))}>
              Lv+1
            </button>
            <button type="button" className="btn btn-dark py-0.5 text-xs" disabled={!uid} onClick={() => mut((r) => void removeCardFromDeck(r, uid))}>
              제거
            </button>
          </div>
          <div className="flex gap-1">
            <select className="flex-1 rounded bg-black" value={tal} onChange={(e) => setTal(e.target.value)}>
              {allTalismans().map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.number} {t.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-dark py-0.5 text-xs" onClick={() => mut((r) => void gainTalisman(r, tal))}>
              부적
            </button>
          </div>
          <div className="flex gap-1">
            <select className="flex-1 rounded bg-black" value={jokbo} onChange={(e) => setJokbo(e.target.value)}>
              {ALL_JOKBO.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-dark py-0.5 text-xs"
              onClick={() =>
                mut((r) => {
                  const j = jokbo as (typeof ALL_JOKBO)[number];
                  r.jokbo[j].level++;
                })
              }
            >
              족보 Lv+1
            </button>
          </div>
          <div className="flex gap-1">
            <select className="flex-1 rounded bg-black" value={stageIdx} onChange={(e) => setStageIdx(Number(e.target.value))}>
              {STAGES.map((s) => (
                <option key={s.index} value={s.index}>
                  {s.month}월 {s.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-dark py-0.5 text-xs" onClick={() => mut((r) => createStage(r, stageIdx))}>
              스테이지로
            </button>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="btn btn-dark flex-1 py-0.5 text-xs"
              onClick={() =>
                mut((r) => {
                  r.reward = generateReward(r, true, 2, `debug${r.nextOpId}`);
                  r.phase = 'reward';
                })
              }
            >
              보상 강제
            </button>
            <button
              type="button"
              className="btn btn-dark flex-1 py-0.5 text-xs"
              onClick={() => mut((r) => void pushOp(r, { kind: 'mutateCard', title: '디버그 변이', description: '', source: 'debug', count: 1, cancellable: true, then: [] }))}
            >
              변이 강제
            </button>
          </div>
          <div className="text-stone-400">
            phase {run.phase}/{run.stage?.phase} · ops {run.ops.length} · nextUid {run.nextUid}
          </div>
          <div className="break-all text-stone-400">RNG {JSON.stringify(run.stage?.rng)}</div>
          {lastChain && (
            <details>
              <summary className="cursor-pointer text-stone-300">
                마지막 연쇄: {lastChain.title} ({lastChain.steps.length}단계, 처리 {lastChain.resolutions}회)
              </summary>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-stone-400">{JSON.stringify(lastChain.steps.map((s) => [s.depth, s.kind, s.title, s.value]), null, 0)}</pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}
