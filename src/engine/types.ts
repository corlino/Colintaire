/**
 * Core game types. The engine models standard 7-column Klondike and knows
 * nothing about screens, the 5+2 layout or card orientation (PRD 4.3, TAD §7).
 *
 * Pile convention: index 0 is the bottom card, the last element is the top
 * (accessible) card. This holds for every pile, including the two piles the
 * presentation layer draws in reversed orientation.
 */

export type Suit = 'S' | 'H' | 'C' | 'D';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type Color = 'red' | 'black';
export type GameMode = 'classic' | 'vegas';

/** Stable, unique identity per card, e.g. "S01" (Ace of spades) or "D13" (King of diamonds). */
export type CardId = string;

export interface Card {
  readonly id: CardId;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly faceUp: boolean;
}

export type Pile = readonly Card[];

export interface Board {
  readonly stock: Pile;
  readonly waste: Pile;
  /** Fixed suit slots, left to right ♠ ♥ ♣ ♦ (decision U7). */
  readonly foundations: readonly [Pile, Pile, Pile, Pile];
  /** Seven logical tableau piles; pile p is dealt p + 1 cards. */
  readonly tableau: readonly [Pile, Pile, Pile, Pile, Pile, Pile, Pile];
}

export type PileRef =
  | { readonly kind: 'stock' }
  | { readonly kind: 'waste' }
  | { readonly kind: 'foundation'; readonly index: number }
  | { readonly kind: 'tableau'; readonly index: number };

export type GameStatus = 'playing' | 'won';

/** The parts of state that undo restores. */
export interface Snapshot {
  readonly board: Board;
  readonly moves: number;
  readonly classicPoints: number;
  readonly credited: readonly CardId[];
  readonly status: GameStatus;
}

export interface GameState {
  readonly seed: number;
  readonly mode: GameMode;
  readonly board: Board;
  readonly moves: number;
  readonly status: GameStatus;
  readonly classic: {
    /** Points earned from moves (decision U1). Restored by undo. */
    readonly points: number;
    /** Accumulated undo penalty, 5 per undo. Never restored by undo (PRD 5.9). */
    readonly undoPenalty: number;
  };
  readonly vegas: {
    /** Cards whose $5 currently counts. Restored by undo. */
    readonly credited: readonly CardId[];
    /** Every card ever paid this game. Never restored by undo (FR-17). */
    readonly everPaid: readonly CardId[];
  };
  readonly undo: {
    /** Undos consumed this game, max 3. Never restored by undo. */
    readonly used: number;
    /** Most recent snapshots, newest last, at most UNDO_LIMIT entries. */
    readonly history: readonly Snapshot[];
  };
}

export type Action =
  | { readonly type: 'MOVE'; readonly from: PileRef; readonly cardIndex: number; readonly to: PileRef }
  | { readonly type: 'DRAW' }
  | { readonly type: 'RECYCLE' }
  | { readonly type: 'UNDO' };

export type GameEvent =
  | { readonly type: 'MOVED'; readonly cardIds: readonly CardId[]; readonly from: PileRef; readonly to: PileRef }
  | { readonly type: 'DREW'; readonly cardId: CardId }
  | { readonly type: 'RECYCLED' }
  | { readonly type: 'FLIP'; readonly cardId: CardId; readonly pile: number }
  | { readonly type: 'PAYOUT'; readonly cardId: CardId; readonly amount: number }
  | { readonly type: 'UNDONE' }
  | { readonly type: 'WON' };

export type ActionError =
  | 'GAME_OVER'
  | 'INVALID_MOVE'
  | 'EMPTY_STOCK'
  | 'STOCK_NOT_EMPTY'
  | 'EMPTY_WASTE'
  | 'NO_UNDO';

export type Result =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: ActionError };
