import type { ReactElement } from 'react';
import { MONTH_INFO, STAGES } from '../../game';
import type { AnimSpeed, GameApi } from '../hooks/useGame';
import { fmt } from '../views';

export function copyText(text: string, game: GameApi): void {
  try {
    void navigator.clipboard?.writeText(text);
    game.toast(`복사됨: ${text}`);
  } catch {
    game.toast(text);
  }
}

export function TopBar({ game, displayedScore, openDeck }: { game: GameApi; displayedScore?: number; openDeck: () => void }): ReactElement {
  const run = game.run!;
  const stage = run.phase === 'stage' || run.phase === 'stageResult' ? run.stage : undefined;
  const between = ['reward', 'crossroads', 'shop', 'event'].includes(run.phase);
  const def = STAGES[Math.min(run.stageIndex + (between ? 1 : 0), STAGES.length - 1)];
  const score = displayedScore ?? stage?.score ?? 0;
  const line = stage?.goLine ?? stage?.target ?? def.target;
  const pct = Math.min(1, score / Math.max(1, line));
  return (
    <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-red-800 px-2 py-1 text-center leading-none">
          <div className="text-lg font-black" style={{ fontFamily: 'var(--font-serif)' }}>
            {def.month}월
          </div>
        </div>
        <div>
          <div className="font-black">
            {def.name} {def.boss && <span className="rounded bg-red-600 px-1 text-[10px]">{def.finalBoss ? '최종 보스' : '보스'}</span>}
          </div>
          <div className="text-[11px] text-stone-400">{between ? `다음 스테이지 · 목표 ${fmt(def.target)}` : `${MONTH_INFO[def.month].plantKo}의 달`}</div>
        </div>
      </div>
      {stage && (
        <div className="min-w-[220px] flex-1">
          <div className="flex justify-between text-sm">
            <span className="font-black text-amber-300">{fmt(score)}</span>
            <span className="text-stone-300">
              {stage.goLine ? <span className="text-red-300">고 기준선 {fmt(stage.goLine)}</span> : <>목표 {fmt(stage.target)}</>}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-stone-800">
            <div className={`h-full rounded-full transition-all duration-300 ${pct >= 1 ? 'bg-amber-400' : 'bg-red-600'}`} style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
      )}
      {stage && (
        <div className="flex gap-3 text-sm">
          <Stat label="턴" value={`${Math.min(stage.turn, stage.turnsTotal)}/${stage.turnsTotal}`} />
          <Stat label="교환" value={stage.exchangesLeft} />
          <Stat label="고" value={stage.goCount ? `${stage.goCount}고` : '-'} />
        </div>
      )}
      <Stat label="엽전" value={run.coins} gold />
      <div className="ml-auto flex flex-wrap items-center gap-1">
        <button type="button" className="btn btn-dark text-xs" onClick={() => copyText(run.seed, game)} title="시드 복사">
          {run.seed}
        </button>
        <button type="button" className="btn btn-dark text-xs" onClick={openDeck}>
          덱 {run.deck.length}
        </button>
        <select
          className="rounded bg-stone-800 px-1 py-1 text-xs"
          value={game.settings.animSpeed}
          onChange={(e) => game.setSettings({ ...game.settings, animSpeed: e.target.value as AnimSpeed })}
          title="연쇄 애니메이션 속도"
        >
          <option value="normal">보통</option>
          <option value="fast">빠르게</option>
          <option value="instant">즉시</option>
        </select>
        <button type="button" className="btn btn-dark text-xs" onClick={game.quitToTitle} title="저장하고 타이틀로">
          타이틀
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string | number; gold?: boolean }): ReactElement {
  return (
    <div className="text-center leading-tight">
      <div className="text-[10px] text-stone-400">{label}</div>
      <div className={`font-black ${gold ? 'text-amber-300' : ''}`}>{value}</div>
    </div>
  );
}
