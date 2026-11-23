# Release checklist — v1.0.0 (TAD §16.2, §17 M7)

Every PRD acceptance criterion and owner decision, and what proves it.
Files: `tests/engine/*` engine unit/property · `tests/layout/layout.test.ts` · `tests/store/*` · `tests/ui/components.test.tsx` · `tests/assets/pipeline.test.ts` · `e2e/game.spec.ts`, `e2e/screens.spec.ts` (Playwright on iPhone 13 mini, iPhone 15 Pro Max, Desktop Chrome).

All automated checks run in GitHub Actions on every push (`.github/workflows/ci.yml`).

## PRD acceptance criteria

| AC | Criterion (short) | Proved by | Status |
|---|---|---|---|
| 1 | Correct deal | deal: "deals 1..7 cards…", "puts the remaining 24 cards…", "uses all 52 unique cards…" | ✅ |
| 2 | 5+2 layout | layout: "draws piles 1–5 downward…"; screens: game screen baseline | ✅ |
| 3 | Bottom row reversed | layout: "draws piles 6–7 reversed… (AC 3)" | ✅ |
| 4 | Same rules on all seven piles | rules: "moves a run between the normal and reversed rows identically (AC 4–5)" | ✅ |
| 5 | Moves across orientations keep order | reducer: "keeps logical order… (AC 5)"; e2e: "drags a card from a reversed bottom stack… (AC 4–5)" | ✅ |
| 6 | Invalid moves blocked | reducer: "rejects invalid moves… (AC 6)"; property: "rejects every illegal move…"; e2e: "springs back an illegal drop… (AC 6)" | ✅ |
| 7 | Face-down card revealed | reducer: "reveals the face-down card left on top…"; e2e drag spec checks the auto-flip | ✅ |
| 8 | One card per stock tap | reducer: "deals exactly one card per draw…"; e2e: "stock deals one card per tap… (AC 8–10)" | ✅ |
| 9 | Unlimited recycling | reducer: "preserves draw order across unlimited recycles"; property test | ✅ |
| 10 | Recycling keeps card order | same as 9; e2e AC 8–10 spec | ✅ |
| 11 | Win state | reducer: "wins when all 52 cards reach the foundations…"; store: "stops the timer on a win…"; e2e: "playing the last cards wins… (AC 11)" | ✅ |
| 12 | Moves, score and time update | components: StatsPanel; e2e drag spec (Moves 1), reload spec (time) | ✅ |
| 13 | Three undos per game | reducer: "allows three undos per game, then disables" | ✅ |
| 14 | Undo costs 5 points (Classic) | reducer: "restores board… and charges 5 points…" | ✅ |
| 15 | Vegas undo reverses the payout | reducer: "undo reverses the payout and the card can never pay again" | ✅ |
| 16 | No double payout | same as 15; property test (balance = 5 × credited − 52) | ✅ |
| 17 | Undo button disabled when used up | reducer: "allows three undos…"; components: "disables Undo until…" | ✅ |
| 18 | Classic restart keeps the deal | session: "Classic restart replays the same deal…"; store restart test | ✅ |
| 19 | Vegas restart charges −$52 | session: "Vegas restart is a new deal with another $52 buy-in…" | ✅ |
| 20 | Mode choice | components: "starts the chosen mode on Confirm"; e2e New Game spec | ✅ |
| 21 | $52 buy-in | session PRD 6.2 example; e2e: "…Vegas starts at −$52" | ✅ |
| 22 | $5 per foundation card | reducer: "pays $5 per card into a foundation" | ✅ |
| 23 | Balance carries over | session: "−52 → −27 → +3 → −49 → +51", "carries the Vegas balance across a Classic game"; e2e reload spec | ✅ |
| 24 | Background changes with theme | components: "a theme only sets the background variables…"; pipeline: "swaps art into existing entries…" | ✅ |
| 25 | Card back changes with style | components: "face-down cards use the selected card back"; pipeline test | ✅ |
| 26 | Fonts and buttons do not change | components: "a theme only sets the background variables…" | ✅ |
| 27 | Modals do not disrupt the game | store: "opening and closing a modal never changes the game"; e2e: Appearance (AC 27), New Game close spec | ✅ |
| 28 | Works on mobile sizes | layout: no-overlap property test on iPhone SE, 13 mini, 15, 15 Pro Max; all e2e specs on two iPhone profiles | ✅ |

## Owner decisions (TAD §2)

| # | Decision | Proved by | Status |
|---|---|---|---|
| U1 | Windows draw-one scoring table | reducer: "scores each move type from the table" | ✅ |
| U2 | Title / win "New game" opens New Game | e2e: New Game spec (title tap), win spec | ✅ |
| U3 | Classic dealt on first launch | store initial state; e2e corrupt-save spec | ✅ |
| U4 | Foundation → tableau allowed | rules: "allows foundation → tableau (U4)…" | ✅ |
| U5 | Manual move out keeps the $5; never pays twice | reducer: "keeps the $5 when a card is moved out by hand… (U5)" | ✅ |
| U6 | Every move, draw and recycle counts | reducer: "counts draw and recycle as moves (U6)" | ✅ |
| U7 | Fixed foundation slots ♠ ♥ ♣ ♦ | rules: "starts with the Ace in its own suit slot" | ✅ |
| U8 | Classic score floored at 0 | reducer: "floors the displayed score at 0" | ✅ |
| U9 | Tap select, tap move, double-tap to foundation | e2e: "tap selects… (U9)"; rules: "finds the double-tap foundation target (U9)" | ✅ |
| U10 | No auto-complete | not built (by design) | ✅ |
| U11 | Timer pauses for modals, background, win | store timer tests; e2e New Game pause, rotate pause | ✅ |
| U12–U13 | localStorage persistence | persistence tests; e2e: "a reload keeps the game… (U12, U13)" | ✅ |
| U14 | Reset-balance with confirm | components: "resets the Vegas balance only after the confirm step (U14)"; session reset tests | ✅ |
| U15 | Vegas ledger carries across Classic games | session: "carries the Vegas balance across a Classic game" | ✅ |
| U16 | Negative balance shows −$52 | components: "formats Vegas balances with a true minus sign" | ✅ |
| U17 | New Game remembers the last mode | e2e reload spec (Vegas still selected) | ✅ |
| U18 | Piles 1–5 top row, 6–7 bottom reversed | layout tests (AC 2–3) | ✅ |
| U19 | Rows never overlap; tighten then fold; peek | layout property test; e2e peek spec | ✅ |
| U20 | Upright bottom-right index | screens: game screen baseline; DECISIONS "Corner index layout" | ✅ |
| U21 | iPhone SE / 13 mini floor; portrait only | layout property test at 375 × 667; e2e rotate spec | ✅ |
| U22 | No pencil icon | screens: Appearance baseline | ✅ |
| U23 | Placeholder art until PNGs arrive | pipeline tests (swap works); final art pending owner | ⏳ art |
| U24 | Home-screen name "Colintaire", header "SOLITAIRE" | manifest in `vite.config.ts`; screens baseline | ✅ |
| U25 | Vercel at colintaire.vercel.app | live; every push to `main` deploys | ✅ |
| U26 | Offline service worker, no analytics | production preview checked offline (M5); no analytics code | ✅ |

## Manual sign-off (owner, on iPhone)

Open https://colintaire.vercel.app in Safari → Share → Add to Home Screen → launch from the icon.

- [ ] Opens full screen; nothing hidden under the notch or home bar
- [ ] Dragging, tapping and double-tapping feel right; peek (+N) works
- [ ] Close and reopen: the game, time and Vegas balance are still there
- [ ] Airplane mode: the app still opens and plays
- [ ] Turning the phone sideways shows "Rotate your phone"
- [ ] Stats stay readable at long values (e.g. −$104, 1:02:05)

When these pass, the release is tagged `v1.0.0`.
