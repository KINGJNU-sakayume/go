import type { ReactElement } from 'react';
import {
  ALL_JOKBO,
  BALANCE,
  JOKBO_DEFS,
  Rng,
  STAGES,
  WEATHER_INFO,
  capturedProfiles,
  evaluateAllJokbo,
  getEvolution,
  jokboEvalRules,
  makeContext,
  type CardView,
  type JokboId,
  type RunState,
} from '../../game';
import { Card } from '../components/Card';
import { useCardHover } from '../components/Hover';
import { Seal } from '../components/Seal';
import { TalismanRow } from '../components/Talismans';
import { fmt } from '../views';

function Pips({ filled, total, color }: { filled: number; total: number; color: string }): ReactElement {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-full"
          style={i < filled ? { background: color, boxShadow: `0 0 0 1px ${color}` } : { boxShadow: 'inset 0 0 0 1.5px rgba(90,70,50,0.45)' }}
        />
      ))}
    </span>
  );
}

/** 족보 장부: a paper ledger of every Jokbo — points, level ×, progress, and what it scored this stage. */
export function JokboLedger({ run, flash }: { run: RunState; flash?: JokboId }): ReactElement {
  const stage = run.stage!;
  const ctx = makeContext(run, stage, new Rng(stage.rng));
  const evals = evaluateAllJokbo(capturedProfiles(ctx), jokboEvalRules(ctx));
  return (
    <div className="panel p-2">
      <div className="section-title mb-1.5">족보 장부</div>
      <div className="hanji divide-y divide-[#8a6b45]/20 rounded px-2 py-1">
        {ALL_JOKBO.map((id) => {
          const def = JOKBO_DEFS[id];
          const e = evals[id];
          const led = stage.ledger[id];
          const prog = run.jokbo[id];
          const active = led.points > 0;
          const isCount = def.rule.kind === 'count' || def.rule.kind === 'fullMonth';
          const pct = Math.min(1, e.progress / e.needed);
          const evoNames = prog.evolutions.map((x) => getEvolution(x)?.name).filter(Boolean);
          return (
            <div
              key={id}
              title={`${def.description}\n레벨 배 ×${BALANCE.jokboLevelMult(prog.level).toFixed(2)}${evoNames.length ? `\n진화: ${evoNames.join(', ')}` : ''}`}
              className={`py-1 text-xs ${flash === id ? 'pop-in rounded bg-amber-200/60' : ''}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-1.5 font-bold">
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-[12px] font-black text-white"
                    style={{ background: def.color, fontFamily: 'var(--font-serif)' }}
                  >
                    {def.glyph}
                  </span>
                  {def.name}
                  <span className="font-normal text-[#7a5a3a]">
                    Lv.{prog.level} ×{BALANCE.jokboLevelMult(prog.level).toFixed(2)}
                  </span>
                  {evoNames.length > 0 && <span className="font-normal text-[#2b3f73]">진화 {evoNames.length}</span>}
                </span>
                <span>
                  {active ? (
                    <b className="text-[#a3170f]">
                      {led.tierLabel ?? `${led.points}점`}
                      {led.sets > 1 ? ` ×${led.sets}` : ''}
                    </b>
                  ) : (
                    <span className="text-[#7a5a3a]">
                      {Math.min(e.progress, e.needed)}/{e.needed}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                {isCount ? (
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-[#8a6b45]/25">
                    <div className="h-full rounded" style={{ width: `${pct * 100}%`, background: def.color }} />
                  </div>
                ) : def.rule.kind === 'gwang' ? (
                  <Pips filled={Math.min(5, e.progress)} total={5} color={def.color} />
                ) : (
                  <Pips filled={(e.slots ?? []).filter(Boolean).length} total={e.needed} color={def.color} />
                )}
                {led.totalScore > 0 && <span className="font-bold text-[#7a1610]">+{fmt(led.totalScore)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ROWS: { key: string; label: string; seal: string; test: (v: CardView) => boolean }[] = [
  { key: 'bright', label: '광', seal: '光', test: (v) => v.bright },
  { key: 'animal', label: '열끗', seal: '獸', test: (v) => v.animal },
  { key: 'ribbon', label: '띠', seal: '帶', test: (v) => v.ribbon },
  { key: 'pi', label: '피', seal: '皮', test: () => true },
];

/** 먹은 패 laid out like the real game: 광 / 열끗 / 띠 / 피 rows of overlapping cards. */
export function CapturedPiles({ run, view }: { run: RunState; view: (uid: string) => CardView }): ReactElement {
  const hover = useCardHover();
  const stage = run.stage!;
  const rows = new Map<string, string[]>(ROWS.map((r) => [r.key, []]));
  for (const uid of stage.captured) {
    const v = view(uid);
    const row = ROWS.find((r) => r.test(v))!;
    rows.get(row.key)!.push(uid);
  }
  const piValue = stage.captured.reduce((s, u) => s + view(u).piValue, 0);
  const stolen = stage.bonusPi ?? 0;
  return (
    <div className="panel p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="section-title">먹은 패</span>
        <span className="text-xs text-stone-400">{stage.captured.length}장</span>
      </div>
      <div className="space-y-2">
        {ROWS.map((r) => {
          const list = rows.get(r.key)!;
          const overlap = list.length > 9 ? -34 : list.length > 5 ? -28 : -16;
          return (
            <div key={r.key}>
              <div className="mb-0.5 flex items-center gap-1.5 text-xs text-stone-300">
                <Seal char={r.seal} size={18} tone={r.key === 'pi' ? 'ink' : 'red'} />
                <b>{r.label}</b> {list.length}장
                {r.key === 'pi' && (
                  <span className="text-stone-400">
                    · 피 {piValue + stolen}
                    {stolen ? ` (뺏은 피 ${stolen})` : ''}
                  </span>
                )}
              </div>
              <div className="flex min-h-[70px] items-center pl-1">
                {list.length === 0 && <span className="text-xs text-stone-600">—</span>}
                {list.map((u, i) => (
                  <div key={u} style={{ marginLeft: i ? overlap : 0, zIndex: i }}>
                    <Card view={view(u)} size="sm" onHover={hover} flipId={u} flipZone="captured" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Talismans outside the stage (reward, shop, event, game over). */
export function TalismanStrip({ run }: { run: RunState; compact?: boolean }): ReactElement {
  return <TalismanRow run={run} size="sm" />;
}

const SC = BALANCE.specialCapture;
const PI = BALANCE.specialPi;
const COIN = BALANCE.specialCoins;
export const GOSTOP_RULES: [string, string][] = [
  ['쪽', `짝 없이 낸 패를 더미에서 뒤집은 패가 바로 먹음 → +${SC.jjok} · 피 ${PI.jjok}장 뺏기`],
  ['따닥', `바닥 같은 달 두 장을 낸 패와 뒤집은 패가 하나씩 먹음 → +${SC.ttadak} · 피 ${PI.ttadak}장 (첫 턴이면 첫따닥: 엽전 +${COIN.firstTtadak})`],
  [
    '뻑',
    `낸 패로 짝을 맞췄는데 뒤집은 패도 같은 달 → 세 장이 바닥에 묶이고 아무것도 못 먹음. 첫뻑 엽전 +${COIN.firstPpeok} · 연뻑 +${COIN.chainPpeok} · 삼뻑은 +${SC.triplePpeok}, 엽전 +${COIN.triplePpeok}, 목표의 ${Math.round(BALANCE.triplePpeokTargetFraction * 100)}% 보너스 (보스 ${Math.round(BALANCE.triplePpeokBossTargetFraction * 100)}%)`,
  ],
  ['자뻑 먹기', `묶인 뻑 세 장을 네 번째 패로 한꺼번에 먹음 → +${SC.ppeokEat} · 피 ${PI.ppeokEat}장`],
  ['싹쓸이', `내 차례에 바닥을 비움 → +${SC.sweep} · 피 ${PI.sweep}장`],
  [
    '흔들기',
    `손에 같은 달 세 장, 바닥엔 없음 → [흔들고 내기]로 그 달 패를 내며 선언 (그냥 내면 흔들지 않음). 선언한 뒤 얻는 점수만 ×${BALANCE.shakeMult} — 일찍 흔들수록 이득, 최대 ${BALANCE.shakeMaxStacks}번 겹침`,
  ],
  ['폭탄', `손에 같은 달 세 장 + 바닥에 한 장 → 한꺼번에 먹음 (+${SC.bomb}). 흔들기 한 번으로 치고 피 ${PI.bomb}장`],
  ['총통', `첫 손패에 같은 달 네 장(또는 광 다섯 장) → +${SC.chongtong} · 첫 턴부터 흔들기 한 번`],
  [
    '고 / 스톱',
    `목표를 넘으면 스톱(안전하게 클리어) 또는 고. 고 1번마다 이후 점수의 배 +${BALANCE.goMultAdd}, 엽전 보상 증가. 대신 새 기준선에 못 미치면 독박 — 그 스테이지 엽전을 잃음.`,
  ],
];

/** Everything the 규칙 modal explains: this month's rule, 끗 × 배, and the Go-Stop special plays. */
export function RulesContent({ run }: { run: RunState }): ReactElement {
  const def = STAGES[run.stage?.stageIndex ?? run.stageIndex];
  const weather = run.stage?.weather ? WEATHER_INFO[run.stage.weather] : undefined;
  return (
    <div className="space-y-4 text-sm text-stone-200">
      <section>
        <div className="section-title mb-1">
          {def.month}월 {def.name} {def.boss ? '· 보스' : ''}
        </div>
        <div className="text-stone-300">{def.description}</div>
        <ul className="mt-1 space-y-0.5">
          {def.ruleText.map((t) => (
            <li key={t}>— {t}</li>
          ))}
        </ul>
        {weather && (
          <div className="mt-1 flex items-center gap-2">
            <Seal char={weather.glyph} size={22} tone="indigo" /> 지금 날씨 {weather.name}: {weather.description}
          </div>
        )}
      </section>
      <section>
        <div className="section-title mb-1">점수 = 끗 × 배</div>
        <div className="text-stone-300">
          <b className="text-stone-100">끗</b>은 더하는 점수입니다 (족보 기본 점수 = 전통 점수 ×100, 카드 파워, 고정 점수). <b className="text-stone-100">배</b>는 곱하는 점수입니다 (족보
          레벨·진화·부적 배율 × 판 배: 흔들기, 고, 부적). 패를 먹을 때도 족보가 날 때도 같은 공식으로 점수가 납니다.
        </div>
      </section>
      <section>
        <div className="section-title mb-1">고스톱 특수 규칙</div>
        <div className="space-y-1">
          {GOSTOP_RULES.map(([k, v]) => (
            <div key={k}>
              <b className="text-amber-100">{k}</b> — {v}
            </div>
          ))}
          <div className="text-stone-500">뺏은 피는 피 족보에 그대로 더해집니다. 비 띠(12월)도 띠 개수에 셉니다.</div>
        </div>
      </section>
    </div>
  );
}
