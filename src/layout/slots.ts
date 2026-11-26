/**
 * Where each logical tableau pile sits on screen (TAD §9.1, decision U18).
 * Piles 1–5 fill the top row growing down; piles 6–7 fill bottom-row columns
 * 1–2 growing up. This is the only place orientation exists.
 */
export type Grow = 'down' | 'up';

export interface Slot {
  readonly row: 'top' | 'bottom';
  readonly col: number;
  readonly grow: Grow;
}

export const SLOT_MAP: readonly Slot[] = [
  { row: 'top', col: 0, grow: 'down' },
  { row: 'top', col: 1, grow: 'down' },
  { row: 'top', col: 2, grow: 'down' },
  { row: 'top', col: 3, grow: 'down' },
  { row: 'top', col: 4, grow: 'down' },
  { row: 'bottom', col: 0, grow: 'up' },
  { row: 'bottom', col: 1, grow: 'up' },
];

/** Columns shared by a top pile and a reversed bottom pile: [topPile, bottomPile]. */
export const SHARED_COLUMNS: readonly (readonly [number, number])[] = [
  [0, 5],
  [1, 6],
];

/** Bottom-row positions of the non-pile elements. */
export const BOTTOM_ROW = { controlsCol: 2, wasteCol: 3, stockCol: 4 } as const;
/** The Restart (reshuffle) button takes the fifth column of the foundation row. */
export const RESTART_COL = 4;
