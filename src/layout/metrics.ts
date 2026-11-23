/**
 * Card metrics from the measured board area (TAD §9.2). The board container
 * already sits inside the safe-area and horizontal padding (applied by CSS),
 * so this only needs its width and height. Nothing is hard-coded per iPhone model.
 */

export const BOARD_MAX_W = 520;
/** Space between the foundation row and the tableau. */
export const ROW_GAP = 16;
/** Clear gap kept between any two stacks that share a column, and above the bottom row. */
export const STACK_GAP = 8;
/** Height of each folded card in a bundle. */
export const FOLD_STRIP = 3;
/** Gap between the stacked Undo and Restart buttons. */
export const CONTROL_GAP = 10;

export interface Metrics {
  /** Board width actually used: 5 cards + 4 gaps. */
  readonly boardW: number;
  readonly boardH: number;
  readonly cardW: number;
  readonly cardH: number;
  readonly gap: number;
  readonly radius: number;
  readonly rankFont: number;
  /** Left edge of each of the five columns. */
  readonly colX: readonly number[];
  /** Top of the tableau region (below the foundation row). */
  readonly tableauTop: number;
  /** Bottom of the board: bottom-row piles, waste, stock and Restart rest on it. */
  readonly floor: number;
  /** Square control button size (Undo, Restart, Appearance). */
  readonly button: number;
  /** Top of the Undo button (the controls column is taller than a card). */
  readonly controlsTop: number;
  /** Natural and minimum fan offsets (TAD §9.4). */
  readonly offsets: { readonly down: number; readonly up: number; readonly downMin: number; readonly upMin: number };
}

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v));

export function computeMetrics(width: number, height: number): Metrics {
  const contentW = Math.max(0, Math.min(width, BOARD_MAX_W));
  const gap = clamp(6, Math.round(contentW * 0.022), 12);
  let cardW = Math.floor((contentW - 4 * gap) / 5);
  let cardH = Math.round(cardW * 1.4);

  // Height check: short screens and landscape desktop windows shrink the cards
  // until the tableau region is at least 3.2 card heights.
  while (cardW > 24 && height - cardH - ROW_GAP < 3.2 * cardH) {
    cardW -= 1;
    cardH = Math.round(cardW * 1.4);
  }

  const boardW = 5 * cardW + 4 * gap;
  const colX = [0, 1, 2, 3, 4].map((c) => c * (cardW + gap));
  const tableauTop = cardH + ROW_GAP;
  const floor = height;
  const button = Math.min(56, cardW);
  const controlsTop = floor - 2 * button - CONTROL_GAP;

  return {
    boardW,
    boardH: height,
    cardW,
    cardH,
    gap,
    radius: clamp(5, Math.round(cardW * 0.09), 7),
    rankFont: clamp(15, cardW * 0.25, 19),
    colX,
    tableauTop,
    floor,
    button,
    controlsTop,
    offsets: {
      down: cardH * 0.1,
      up: cardH * 0.24,
      downMin: cardH * 0.05,
      upMin: Math.max(cardH * 0.17, 15),
    },
  };
}
