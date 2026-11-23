# Colintaire

Mobile-first Klondike Solitaire PWA with a custom 5+2 tableau. Vite + React 19 + TypeScript (strict) + Tailwind v4 + Zustand + Motion + Heroicons. Client-only, no backend.

## Sources of truth
- Behaviour: PRD v1.2 — `reference-assets/PRD.pdf`
- Visuals: Style Guide v1.1 — `reference-assets/STYLE_GUIDE.pdf`, screenshots in `reference-assets/concept-screens.webp`
- Code structure: Technical Architecture (TAD) — https://claude.ai/artifact/A4r9GFSuAGbXxn1pgFChbR
- Conflict rule: PRD wins on behaviour, Style Guide on visuals, TAD on code structure. TAD §2 owner decisions (U1–U26) are final.
- Any new choice not covered there goes in `docs/DECISIONS.md`.

## Layers (imports only point downward)
- `src/engine/` — pure rules, scoring, undo. No React, DOM, layout, store or assets (ESLint enforces).
- `src/store/` — session concerns: Vegas ledger (`session.ts`), timer, modals.
- `src/layout/` — pure `computeLayout`: 7-pile board → 5+2 screen positions. Orientation lives only here.
- `src/ui/` — React components. Never decides move legality; dispatches actions to the engine.
- `src/assets/` — registries for themes, card backs, card faces.

## Rules
- Write tests first for engine changes. Run `npm run check` (typecheck + lint + test) before committing.
- No colour, font size, radius or duration outside the tokens in `src/styles/index.css`.
- All art is placeholder until the owner supplies PNGs in `art/` (TAD §12.5).

## Commands
`npm run dev` (add `-- --host` to test on a phone over Wi-Fi) · `npm run test` · `npm run coverage` · `npm run e2e` (Playwright: iPhone 13 mini, iPhone 15 Pro Max, Desktop Chrome) · `npm run check` · `npm run build`

Dev-only hook for tests and manual checks: `window.__colintaire.newGame({ seed, mode })`, `.loadGame(state)`, `.getState()`.
