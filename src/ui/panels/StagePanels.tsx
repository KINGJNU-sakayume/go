import type { ReactElement } from 'react';
import {
  ALL_JOKBO,
  BALANCE,
  JOKBO_DEFS,
  MONTH_INFO,
  Rng,
  WEATHER_INFO,
  capturedProfiles,
  evaluateAllJokbo,
  getEvolution,
  getTalismanDef,
  jokboEvalRules,
  makeContext,
  shakeFactor,
  type CardView,
  type JokboId,
  type RunState,
} from '../../game';
import { Card } from '../components/Card';
import { useCardHover } from '../components/Hover';
import { RARITY_STYLE } from '../components/Modal';
import { fmt } from '../views';

function Boxes({ filled, total, color }: { filled: number; total: number; color: string }): ReactElement {
  return (
    <span className="font-mono tracking-tighter">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{ color: i < filled ? color : '#57534e' }}>
          {i < filled ? '■' : '□'}
        </span>
      ))}
    </span>
  );
}

export function JokboPanel({ run, flash }: { run: RunState; flash?: JokboId }): ReactElement {
  const stage = run.stage!;
  const ctx = makeContext(run, stage, new Rng(stage.rng));
  const evals = evaluateAllJokbo(capturedProfiles(ctx), jokboEvalRules(ctx));
  return (
    <div className="panel p-2">
      <div className="mb-1 text-xs font-black tracking-widest text-amber-200">족보</div>
      <div className="space-y-1">
        {ALL_JOKBO.map((id) => {
          const def = JOKBO_DEFS[id];
          const e = evals[id];
          const led = stage.ledger[id];
          const prog = run.jokbo[id];
          const active = led.points > 0;
          const isCount = def.rule.kind === 'count';
          const pct = Math.min(1, e.progress / e.needed);
          const evoNames = prog.evolutions.map((x) => getEvolution(x)?.name).filter(Boolean);
          return (
            <div
              key={id}
              title={`${def.description}\n레벨 배율 ×${BALANCE.jokboLevelMult(prog.level).toFixed(2)}${evoNames.length ? `\n진화: ${evoNames.join(', ')}` : ''}`}
              className={`rounded px-1.5 py-1 text-xs ${active ? 'bg-white/10' : ''} ${flash === id ? 'pop-in ring-2 ring-amber-300' : ''}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold" style={{ color: def.color }}>
                  {def.glyph} {def.name}
                  <span className="ml-1 text-[10px] text-stone-400">Lv.{prog.level}</span>
                  {evoNames.length > 0 && <span className="ml-1 text-[10px] text-cyan-300">✦{evoNames.length}</span>}
                </span>
                <span className="text-[11px] text-stone-300">
                  {active ? (
                    <b className="text-amber-300">
                      {led.tierLabel ?? `${led.points}점`}
                      {led.sets > 1 ? ` ×${led.sets}` : ''}
                    </b>
                  ) : (
                    `${Math.min(e.progress, e.needed)} / ${e.needed}`
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                {isCount || def.rule.kind === 'fullMonth' ? (
                  <div className="mr-2 h-1.5 flex-1 overflow-hidden rounded bg-stone-700">
                    <div className="h-full rounded" style={{ width: `${pct * 100}%`, background: def.color }} />
                  </div>
                ) : def.rule.kind === 'gwang' ? (
                  <Boxes filled={Math.min(5, e.progress)} total={5} color={def.color} />
                ) : (
                  <Boxes filled={(e.slots ?? []).filter(Boolean).length} total={e.needed} color={def.color} />
                )}
                {isCount && <span className="text-[10px] text-stone-400">{e.progress}</span>}
                {led.totalScore > 0 && <span className="ml-1 text-[10px] text-amber-200">+{fmt(led.totalScore)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const GROUPS: { key: string; label: string; test: (v: CardView) => boolean }[] = [
  { key: 'joker', label: '조커', test: (v) => v.joker },
  { key: 'bright', label: '광', test: (v) => v.bright },
  { key: 'animal', label: '열끗', test: (v) => v.animal },
  { key: 'ribbon', label: '띠', test: (v) => v.ribbon },
  { key: 'pi', label: '피', test: (v) => v.piValue > 0 },
];

export function CapturedPanel({ run, view }: { run: RunState; view: (uid: string) => CardView }): ReactElement {
  const hover = useCardHover();
  const stage = run.stage!;
  const buckets = new Map<string, string[]>();
  for (const uid of stage.captured) {
    const v = view(uid);
    const g = GROUPS.find((x) => x.test(v)) ?? GROUPS[4];
    buckets.set(g.key, [...(buckets.get(g.key) ?? []), uid]);
  }
  const piValue = stage.captured.reduce((s, u) => s + view(u).piValue, 0);
  const stolen = stage.bonusPi ?? 0;
  return (
    <div className="panel p-2">
      <div className="mb-1 flex justify-between text-xs font-black tracking-widest text-amber-200">
        <span>먹은 패</span>
        <span className="text-stone-400">{stage.captured.length}장</span>
      </div>
      <div className="space-y-1.5">
        {[GROUPS[1], GROUPS[2], GROUPS[3], GROUPS[4], GROUPS[0]].map((g) => {
          const list = buckets.get(g.key) ?? [];
          return (
            <div key={g.key}>
              <div className="text-[11px] text-stone-400">
                {g.label} {list.length}
                {g.key === 'pi' ? ` (피 ${piValue + stolen}${stolen ? ` · 뺏은 피 ${stolen}` : ''})` : ''}
              </div>
              <div className="flex min-h-[20px] flex-wrap gap-0.5">
                {list.map((u) => (
                  <Card key={u} view={view(u)} size="xs" onHover={hover} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TalismanStrip({ run, compact }: { run: RunState; compact?: boolean }): ReactElement {
  return (
    <div className="panel p-2">
      <div className="mb-1 text-xs font-black tracking-widest text-amber-200">부적 {run.talismans.length}</div>
      {run.talismans.length === 0 && <div className="text-[11px] text-stone-500">아직 없음 — 보상과 상점에서 모으세요. 슬롯 제한 없음.</div>}
      <div className={`flex flex-wrap gap-1 ${compact ? 'max-h-28 overflow-y-auto scrollbar-thin' : ''}`}>
        {run.talismans.map((t) => {
          const def = getTalismanDef(t.id);
          if (!def) return null;
          return (
            <span key={t.id} className={`group relative cursor-help rounded border bg-black/30 px-1.5 py-0.5 text-[11px] ${RARITY_STYLE[def.rarity]}`}>
              {def.glyph} {def.name}
              <span className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden w-60 rounded border border-amber-200/30 bg-stone-950 p-2 text-[11px] text-stone-200 shadow-xl group-hover:block">
                <b>
                  #{def.number} {def.name}
                </b>
                <br />
                {def.description}
                {Object.keys(t.counters).length > 0 && <div className="mt-1 text-amber-300">{JSON.stringify(t.counters)}</div>}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

const SC = BALANCE.specialCapture;
const PI = BALANCE.specialPi;
const COIN = BALANCE.specialCoins;
const GOSTOP_RULES: [string, string][] = [
  ['쪽', `짝 없이 낸 패를 더미에서 뒤집은 패가 바로 먹음 → +${SC.jjok} · 피 ${PI.jjok}장 뺏기`],
  ['따닥', `바닥 같은 달 두 장을 낸 패와 뒤집은 패가 하나씩 먹음 → +${SC.ttadak} · 피 ${PI.ttadak}장 (첫 턴이면 첫따닥: 엽전 +${COIN.firstTtadak})`],
  [
    '뻑',
    `낸 패로 짝을 맞췄는데 뒤집은 패도 같은 달 → 세 장이 바닥에 묶이고 아무것도 못 먹음. 첫뻑 엽전 +${COIN.firstPpeok} · 연뻑 +${COIN.chainPpeok} · 삼뻑은 +${SC.triplePpeok}, 엽전 +${COIN.triplePpeok}, 즉시 목표 달성`,
  ],
  ['자뻑 먹기', `묶인 뻑 세 장을 네 번째 패로 한꺼번에 먹음 → +${SC.ppeokEat} · 피 ${PI.ppeokEat}장`],
  ['싹쓸이', `내 차례에 바닥을 비움 → +${SC.sweep} · 피 ${PI.sweep}장`],
  ['흔들기', `손에 같은 달 세 장, 바닥엔 없음 → 그 달 패를 내면 자동 선언, 이후 점수 ×${BALANCE.shakeMult} (최대 ${BALANCE.shakeMaxStacks}번 겹침)`],
  ['폭탄', `손에 같은 달 세 장 + 바닥에 한 장 → 한꺼번에 먹음 (+${SC.bomb}). 흔들기 한 번으로 치고 피 ${PI.bomb}장`],
  ['총통', `첫 손패에 같은 달 네 장(또는 광 다섯 장) → +${SC.chongtong} · 흔들기 두 번 (흔들기 + 폭탄)`],
];

/** Collapsible cheat sheet of the Go-Stop special plays. */
export function GoStopRulesPanel(): ReactElement {
  return (
    <details className="panel p-2 text-[11px] text-stone-300">
      <summary className="cursor-pointer text-xs font-black tracking-widest text-amber-200">고스톱 특수 규칙</summary>
      <div className="mt-1 space-y-1">
        {GOSTOP_RULES.map(([k, v]) => (
          <div key={k}>
            <b className="text-amber-100">{k}</b> — {v}
          </div>
        ))}
        <div className="text-stone-500">뺏은 피는 피 족보에 그대로 더해집니다.</div>
      </div>
    </details>
  );
}

export function MultiplierPanel({ run }: { run: RunState }): ReactElement {
  const stage = run.stage!;
  const globalAdd = run.modifiers.permanentGlobalAdd + stage.globalMultAdd;
  const months = Object.entries(stage.monthMult).filter(([, v]) => v && v !== 1);
  return (
    <div className="panel space-y-0.5 p-2 text-[11px]">
      <div className="mb-1 text-xs font-black tracking-widest text-amber-200">배율</div>
      <div className="flex justify-between">
        <span className="text-stone-400">기본 전체 배율</span>
        <b>
          ×{(1 + globalAdd).toFixed(2)}
          {stage.globalMultFactor !== 1 ? ` ×${stage.globalMultFactor.toFixed(2)}` : ''}
        </b>
      </div>
      {months.map(([m, v]) => (
        <div key={m} className="flex justify-between">
          <span className="text-stone-400">
            {m}월 {MONTH_INFO[Number(m) as 1].plantKo}
          </span>
          <b>×{(v as number).toFixed(2)}</b>
        </div>
      ))}
      {stage.weather && (
        <div className="flex justify-between">
          <span className="text-stone-400">날씨</span>
          <b>
            {WEATHER_INFO[stage.weather].glyph} {WEATHER_INFO[stage.weather].name}
          </b>
        </div>
      )}
      {stage.weather && <div className="text-stone-400">{WEATHER_INFO[stage.weather].description}</div>}
      {(stage.shakeCount ?? 0) > 0 && (
        <div className="flex justify-between">
          <span className="text-stone-400">흔들기 {stage.shakeCount}회</span>
          <b className="text-pink-300">×{shakeFactor(stage.shakeCount)}</b>
        </div>
      )}
      {(stage.ppeokCount ?? 0) > 0 && (
        <div className="flex justify-between">
          <span className="text-stone-400">뻑</span>
          <b className="text-red-300">{stage.ppeokCount}회{stage.ppeokCount >= 3 ? ' (삼뻑)' : ''}</b>
        </div>
      )}
      {(stage.bonusPi ?? 0) > 0 && (
        <div className="flex justify-between">
          <span className="text-stone-400">뺏은 피</span>
          <b className="text-lime-300">+{stage.bonusPi}</b>
        </div>
      )}
      {stage.retriggersThisStage > 0 && (
        <div className="flex justify-between">
          <span className="text-stone-400">재발동</span>
          <b>{stage.retriggersThisStage}</b>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-stone-400">덱</span>
        <b>{run.deck.length}장</b>
      </div>
      <div className="pt-1 text-[10px] text-stone-500">족보 배율·부적 배율은 족보 점수가 날 때 상세 내역으로 표시됩니다.</div>
    </div>
  );
}
