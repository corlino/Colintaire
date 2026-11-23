# Decisions log

Choices made during implementation that the PRD, Style Guide and TAD §2 do not cover.

| Date | Area | Decision | Why |
|---|---|---|---|
| 2026-11-23 | Vegas payouts in Classic | The engine only tracks `credited`/`everPaid` when the game mode is Vegas. | Keeps Classic state clean; the ledger only reads Vegas games. |
| 2026-11-23 | Session logic placement | New game / restart / reset balance are pure functions in `src/store/session.ts`; the Zustand store (M4) wraps them. | Lets the PRD 6.2 ledger example be unit-tested without React. |
| 2026-11-23 | Tooling versions | TypeScript 6, Vite 8, Vitest 5, Motion 14 (latest stable at project start; TAD lists minimums). | TAD §4: use latest stable. |
