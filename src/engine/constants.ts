import type { Suit } from './types';

/** Fixed foundation slot order, left to right (decision U7). */
export const FOUNDATION_SUITS: readonly Suit[] = ['S', 'H', 'C', 'D'];

/** Fixed order used to build the deck before shuffling. */
export const SUITS: readonly Suit[] = ['S', 'H', 'C', 'D'];

export const TABLEAU_PILES = 7;
export const UNDO_LIMIT = 3;

/** Classic scoring table (decision U1: standard draw-one Windows scoring). */
export const CLASSIC_POINTS = {
  wasteToTableau: 5,
  wasteToFoundation: 10,
  tableauToFoundation: 10,
  turnOver: 5,
  foundationToTableau: -15,
  undoPenalty: 5,
} as const;

/** Vegas scoring (PRD 6.2). */
export const VEGAS = {
  buyIn: 52,
  payout: 5,
} as const;
