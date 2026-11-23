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
| 2026-11-23 | Peek panel picking | Tapping a face-up card in the peek panel selects it (and the cards above it) and closes the panel; the player then taps a destination. Dragging from inside the panel is not supported. | TAD §9.4 asks for dragging from the panel; tap-to-select covers the same need (moving from the middle of a folded run) with far less input complexity. Revisit if it feels clumsy on device. |
| 2026-11-23 | Selection outline | The picked card gets a 2 px turquoise (accent) outline; the rest of the run lifts without an outline. | Style Guide 6.1 asks for a visible lift or outline; white or grey outlines vanish against white cards and the dark board. Turquoise is the only existing accent. |
| 2026-11-23 | Tap hit-testing | Taps and presses find cards from layout positions, not the DOM. | A card still animating into place can be tapped where it is going; found in manual testing (a double-tap during the 180 ms draw animation missed). |
| 2026-11-23 | Vegas hint | The New Game modal shows one line under the selector when Vegas is chosen: "Costs $52 to deal. Each card on a foundation pays $5." | Makes the virtual buy-in clear before confirming. Easy to remove. |
