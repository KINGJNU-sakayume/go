# 화투 로그라이크 · Hwatu Roguelike

A single-player Hwatu (화투) roguelike deckbuilder for the browser. You start with an almost-normal deck
(48 cards + 2 Service Jokers), then delete, duplicate, mutate, enhance, re-dye and distort it across a
12-month run until one capture sets off a chain like:

```
CHEONGDAN COMPLETE → ECHO! → RETRIGGER CHEONGDAN → 끝없는 푸름 → RETRIGGER → RIBBONS COMPLETE
→ 청파 → 푸른 물결 → FULL MONTH ×2 → 뭉치 획득!      +34,236
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
- **교환 (Exchange)**: discard a hand card and draw one (2 per stage by default).
- Jokbo score when completed, when their count goes up, or when explicitly retriggered — never
  again "just because" on later turns. Duplicated set cards can complete the same set Jokbo again.
- Reach the target before your last turn and choose **STOP** (clear safely) or **GO** (keep playing for
  more coins and better rewards; end below the new line and you're 독박).
- Between months: pick 1 of 3 rewards, then choose a shop or an event. Bosses in March, June, September
  and December. Hover any card for a full explanation of every rule it bends.

## Design notes

| Area | Where |
| --- | --- |
| Card / Jokbo / talisman / stage / event data | `src/game/cards`, `jokbo`, `talismans`, `stages`, `events` |
| Effect DSL (trigger + conditions + effects) | `src/game/types/effects.ts`, `src/game/effects/*` |
| Trigger engine (event queue, loop safety, chain log) | `src/game/engine/trigger.ts` |
| Turn state machine, GO/STOP, exchange, bomb | `src/game/engine/stage.ts` |
| Scoring pipeline `(Base×BaseMult + Power + Flat) × JokboMult × GlobalMult` | `src/game/scoring/pipeline.ts` |
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
  per-signature repeat cap; a true loop stops that branch with **과열! / OVERFLOW** and keeps the score.
- **Determinism**: one seed (`HWATU-XXXXXX`) derives independent RNG streams per stage, shop, reward,
  event and operation, so the same seed and choices reproduce the run. `Math.random` is never used for
  game logic (only to mint a new seed).
- **Saves** are versioned (`SAVE_VERSION` + migration table) and only written at safe points (turn
  boundaries, results, rewards, shops, events) — never in the middle of a turn.

### Balance (tuning values, not sacred numbers)

Stage targets are `700 / 1,000 / 1,300 / 1,800 / 2,500 / 3,700 / 5,000 / 7,000 / 10,000 / 14,500 /
21,000 / 32,000` (the spec's 800 → 50,000 curve, softened early after simulation). `npm run sim`
shows the base deck clears January ~90% with a greedy bot, while a non-building bot stalls in spring;
an engineered 33-card Cheongdan/retrigger deck scores a median ~23k in September (target 10k) and
~32k in December even with a naive pilot. Early levels are deliberately modest; broken builds are
supposed to be broken. All numbers live in `src/game/config/balance.ts`, `config/rules.ts` and the
stage/talisman data.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds, tests and deploys `dist/` on pushes to `main` (or manually via
*Run workflow*). In the repository settings set **Pages → Build and deployment → Source: GitHub
Actions**. The build uses a relative base path, so it works at `https://<user>.github.io/<repo>/`.
`.github/workflows/ci.yml` runs typecheck, tests and the build on other branches and pull requests.

Card art is original SVG/CSS (month motifs, Korean labels) — no scans of commercial cards.
