# 화투 로그라이크 · Hwatu Roguelike

A single-player Hwatu (화투) roguelike deckbuilder for the browser. You start with an almost-normal deck
(48 cards + 2 Service Jokers), then delete, duplicate, mutate, enhance, re-dye and distort it across a
12-month run until one capture sets off a chain like:

```
청단 완성! → 메아리! → 청단 재발동 → 끝없는 푸름 → 재발동 → 띠 완성!
→ 청파 → 푸른 물결 → 한 달 모음 ×2 → 뭉치 획득!      +34,236
```

Stack: Vite · React 19 · TypeScript · Tailwind CSS 4 · Vitest. No backend; saves go to `localStorage`.

## Running

```bash
npm ci
npm run dev        # http://localhost:5173 (debug panel is on in dev)
npm test           # core rules test suite (Vitest)
npm run typecheck
npm run build      # production build → dist/
npm run sim        # balance simulations (greedy bots, not part of CI)
```

Add `?debug` to the URL of a production build to show the debug panel (seed, coins, add/remove cards,
talismans, Jokbo levels, jump to stage, force rewards, inspect the last trigger chain and RNG state).

## How to play

- Each month is a stage: 8 cards in hand, 8 on the field, 8 turns. Play a card; if a field card shares a
  month you capture both, then the top of the stock is revealed and resolved the same way.
- Click a hand card to select it (matching field cards glow), click again to play, or click a glowing
  field card to choose exactly what you take. Three of a month on the field are swept together;
  three of a month in hand plus one on the field enables **폭탄 (bomb)**.
- Go-Stop special plays (in-game cheat sheet: *고스톱 특수 규칙* panel):
  - **쪽 / 따닥 / 싹쓸이** score a bonus and **steal 피** (피 뺏기): stolen 피 has no card behind it but
    counts toward the 피 Jokbo. 첫따닥 (따닥 on turn 1) also pays 엽전.
  - **뻑**: your hand card pairs with a field card, then the stock card is the same month with nothing else
    to take — all three stay stacked on the field and nothing is captured. **첫뻑 / 연뻑** pay 엽전 like
    the table pays money; **삼뻑** (third of the stage) pays more plus 40% of the target (20% on boss
    stages). It no longer wins outright. The fourth card of that month eats the pile: **자뻑 먹기**
    (bonus + 2 피).
  - **흔들기**: holding three of a month with none on the field, select one of them and press
    **흔들고 내기** — a plain play does not shake. Every score *after* the declaration is ×2; the score
    already on the board is not doubled, so shaking early versus waiting for a 폭탄 is a real decision.
    **폭탄** counts as a shake, **총통** (four of a month or all five 광 in the opening hand) gives one stack
    for the whole stage. Stacks multiply up to 2 (×4).
  - **고**: every GO adds +0.5 to the multiplier (배) of later scores, like the real game's 고 points.
  - All ten ribbons count for the 띠 Jokbo, the December (비) ribbon included.
  - Not adapted: 총통's optional instant win (stages are won on score), opponent penalties (광박/피박/멍박)
    and the last-turn exception for 피 뺏기 — there is no opponent to pay.
- **교환 (Exchange)**: discard a hand card and draw one (2 per stage by default).
- Jokbo score when completed, when their count goes up, or when explicitly retriggered — never
  again "just because" on later turns. Duplicated set cards can complete the same set Jokbo again.
- Reach the target before your last turn and choose **스톱** (clear safely) or **고** (keep playing for
  more coins, better rewards and a bigger 배; end below the new line and you're 독박).
- **Scores are 끗 × 배**: 끗 is what adds (the Jokbo's traditional points ×100, card power, flat bonuses),
  배 is what multiplies (Jokbo level and evolutions, talismans, then the stage's 판 배: 흔들기, 고…).
  The scoreboard shows every score as `[끗] × [배] = +점`; the talisman behind a multiplier jolts.
- **Identity operations roll inside a range.** Changing a card's month (±1–2), adding a second month,
  a matching month (±2–3) or a category, re-dyeing a ribbon's slot, or 산신당's Jokbo training shows the
  range and rolls when you confirm. Picking the exact result is the premium version (화공의 붓 14 엽전,
  장인의 염료 13, paid event choices). Rolls are seeded, so reloading does not re-roll them.
- Between months: pick 1 of 3 rewards, then choose a shop or an event. Bosses in March, June, September
  and December. Hover any card for a full explanation of every rule it bends.

## Design notes

| Area | Where |
| --- | --- |
| Card / Jokbo / talisman / stage / event data | `src/game/cards`, `jokbo`, `talismans`, `stages`, `events` |
| Effect DSL (trigger + conditions + effects) | `src/game/types/effects.ts`, `src/game/effects/*` |
| Trigger engine (event queue, loop safety, chain log) | `src/game/engine/trigger.ts` |
| Turn state machine, 고/스톱, exchange, 폭탄, 뻑, 흔들기 | `src/game/engine/stage.ts` |
| Scoring pipeline `(Base×BaseMult + Power + Flat) × JokboMult × GlobalMult` (shown as 끗 × 배) | `src/game/scoring/pipeline.ts` |
| Deck operations (remove/upgrade/clone/mutate/dye/graft/purify/Joker workshop) | `src/game/engine/operations.ts` |
| Rewards, shop, run flow, saves | `src/game/rewards`, `shop`, `engine/run.ts`, `save` |
| UI (no rule logic) | `src/ui` |

- **Card identity**: every physical card is a `CardInstance` (`uid`) pointing at a `CardDefinition`
  (`defId`). Months used for *scoring* (printed + Split/Triple Moon) are separate from months used for
  *matching* (+ Dual Month, Adjacent, Wild).
- **Talismans** (50 required + 5 Exchange extras) are pure data: `trigger`, `conditions`, `effects`.
  Bespoke logic is referenced by id (`{ kind: 'custom', id }`). There are no talisman slots.
- **Trigger engine**: effects only return new events; core rules apply state. Events resolve
  depth-first so the chain reads cause → effect. Safety: 240 resolutions per chain, depth 48, and a
  per-signature repeat cap; a true loop stops that branch with **과열!** and keeps the score.
- **Determinism**: one seed (`HWATU-XXXXXX`) derives independent RNG streams per stage, shop, reward,
  event and operation, so the same seed and choices reproduce the run. `Math.random` is never used for
  game logic (only to mint a new seed).
- **Saves** are versioned (`SAVE_VERSION` + migration table) and only written at safe points (turn
  boundaries, results, rewards, shops, events) — never in the middle of a turn.

### Balance (tuning values, not sacred numbers)

Stage targets are `540 / 800 / 1,250 / 1,700 / 2,300 / 2,900 / 4,000 / 5,600 / 8,500 / 13,000 /
20,000 / 32,000`. With the greedy bot (`npm run sim`), the base deck clears January 96%, February
70% and March 47%; a modest June build (40 cards, 청단 Lv3 with one evolution, four talismans) clears
June 38%; an engineered 33-card Cheongdan/retrigger deck clears September 90% and December 58%.
Early levels are deliberately modest; broken builds are supposed to be broken. All numbers live in
`src/game/config/balance.ts`, `config/rules.ts` and the stage/talisman data. The analysis behind the
current numbers is in [`docs/balance-patch-plan.md`](docs/balance-patch-plan.md).

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds, tests and deploys `dist/` on pushes to `main` (or manually via
*Run workflow*). In the repository settings set **Pages → Build and deployment → Source: GitHub
Actions**. The build uses a relative base path, so it works at `https://<user>.github.io/<repo>/`.
`.github/workflows/ci.yml` runs typecheck, tests and the build on other branches and pull requests.

Card art is original SVG/CSS (month motifs, Korean labels) — no scans of commercial cards. The 판화
card theme (default; toggle **그림** in the top bar) uses the linocut prints in
`public/assets/themes/linocut/` where they exist — January so far (`month-01.webp`). The months 1–3
sheet (`months-01-03.webp`) is not a decodable image and needs re-exporting before it can be used.
