import type { ReactElement } from 'react';
import { MONTH_INFO, STAGES } from '../../game';
import type { AnimSpeed, GameApi } from '../hooks/useGame';
import { Seal } from '../components/Seal';
import { fmt } from '../views';

export function copyText(text: string, game: GameApi): void {
  try {
    void navigator.clipboard?.writeText(text);
    game.toast(`복사됨: ${text}`);
  } catch {
    game.toast(text);
  }
}

export function TopBar({ game, openDeck, openRules }: { game: GameApi; openDeck: () => void; openRules?: () => void }): ReactElement {
  const run = game.run!;
  const stage = run.phase === 'stage' || run.phase === 'stageResult' ? run.stage : undefined;
  const between = ['reward', 'crossroads', 'shop', 'event'].includes(run.phase);
  const def = STAGES[Math.min(run.stageIndex + (between ? 1 : 0), STAGES.length - 1)];
  const s = game.settings;
  return (
    <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-11 w-11 flex-col items-center justify-center rounded-sm text-[#fff2e6]"
          style={{ background: 'var(--vermilion)', boxShadow: 'inset 0 0 0 2px rgba(255,230,210,0.5)', fontFamily: 'var(--font-serif)' }}
        >
          <span className="text-lg font-black leading-none">{def.month}</span>
          <span className="text-[11px] font-bold leading-none">月</span>
        </div>
        <div>
          <div className="flex items-center gap-1.5 font-black" style={{ fontFamily: 'var(--font-serif)' }}>
            {def.name}
            {def.boss && <Seal char={def.finalBoss ? '終' : '將'} size={18} />}
          </div>
          <div className="text-xs text-stone-400">
            {between ? `다음 달 · 목표 ${fmt(def.target)}` : `${MONTH_INFO[def.month].plantKo}의 달${def.boss ? (def.finalBoss ? ' · 최종 보스' : ' · 보스') : ''}`}
          </div>
        </div>
      </div>
      {stage && (
        <div className="flex gap-4 text-sm">
          <Stat label="턴" value={`${Math.min(stage.turn, stage.turnsTotal)}/${stage.turnsTotal}`} />
          <Stat label="교환" value={stage.exchangesLeft} />
          <Stat label="덱" value={`${run.deck.length}장`} />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <Seal char="錢" size={22} tone="gold" round />
        <span className="text-lg font-black text-amber-300 tabular-nums">{run.coins}</span>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-1">
        {openRules && (
          <button type="button" className="btn btn-dark text-xs" onClick={openRules}>
            규칙
          </button>
        )}
        <button type="button" className="btn btn-dark text-xs" onClick={openDeck}>
          덱 보기
        </button>
        <button type="button" className="btn btn-dark text-xs" onClick={() => copyText(run.seed, game)} title="시드 복사">
          {run.seed}
        </button>
        <select
          className="rounded border border-amber-200/20 bg-black/40 px-1 py-1 text-xs"
          value={s.animSpeed}
          onChange={(e) => game.setSettings({ ...s, animSpeed: e.target.value as AnimSpeed })}
          title="연출 속도"
        >
          <option value="normal">연출 보통</option>
          <option value="fast">연출 빠르게</option>
          <option value="instant">연출 생략</option>
        </select>
        <button
          type="button"
          className="btn btn-dark text-xs"
          title="카드 그림: 리노컷 판화(있는 달만) / 기본"
          onClick={() => game.setSettings({ ...s, cardTheme: s.cardTheme === 'linocut' ? 'classic' : 'linocut' })}
        >
          그림 {s.cardTheme === 'linocut' ? '판화' : '기본'}
        </button>
        <button type="button" className="btn btn-dark text-xs" onClick={() => game.setSettings({ ...s, sound: !s.sound })} title="효과음">
          소리 {s.sound ? '켬' : '끔'}
        </button>
        <button type="button" className="btn btn-dark text-xs" onClick={game.quitToTitle} title="저장하고 타이틀로">
          타이틀
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): ReactElement {
  return (
    <div className="text-center leading-tight">
      <div className="text-xs text-stone-400">{label}</div>
      <div className="font-black tabular-nums">{value}</div>
    </div>
  );
}
