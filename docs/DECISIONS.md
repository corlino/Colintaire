# Decisions log

Choices made during implementation that the PRD, Style Guide and TAD §2 do not cover.

| Date | Area | Decision | Why |
|---|---|---|---|
| 2026-11-23 | Vegas payouts in Classic | The engine only tracks `credited`/`everPaid` when the game mode is Vegas. | Keeps Classic state clean; the ledger only reads Vegas games. |
| 2026-11-23 | Session logic placement | New game / restart / reset balance are pure functions in `src/store/session.ts`; the Zustand store (M4) wraps them. | Lets the PRD 6.2 ledger example be unit-tested without React. |
| 2026-11-23 | Tooling versions | TypeScript 6, Vite 8, Vitest 5, Motion 14 (latest stable at project start; TAD lists minimums). | TAD §4: use latest stable. |
| 2026-11-23 | Card corner index | Each corner row shows rank and suit side by side: top row rank-left/suit-right, bottom row suit-left/rank-right, both upright. | Matches the concept screenshot and keeps both rank and suit inside a narrow fanned strip in either orientation (U20). |
| 2026-11-23 | Centre pip | Placeholder faces show one large centre suit symbol. | TAD §12.3; only visible on uncovered cards. Replaceable via the card-face registry. |
| 2026-11-23 | Folded spacing | After folding, leftover column space is shared back to the unfolded face-up strips (up to natural spacing). | Folding saves whole-card steps and otherwise left up to ~50 px unused between rows; the 8 px row gap is still guaranteed. |
| 2026-11-23 | Shell heights | Header 72 px, stats 68 px, 12 px gap above stats, 8 px below; board fills the rest. | Style Guide recommended ranges; one constant set (`src/ui/shellSizes.ts`) shared by UI and layout tests. |
