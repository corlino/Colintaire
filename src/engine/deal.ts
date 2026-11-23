import { buildDeck, withFace } from './cards';
import { TABLEAU_PILES } from './constants';
import { mulberry32, shuffle } from './rng';
import type { Board, Card, GameMode, GameState } from './types';

/** Shuffle with the seed and deal Klondike: pile p gets p + 1 cards, top card face up, 24 to stock (PRD 5.2). */
export function dealBoard(seed: number): Board {
  const deck = shuffle(buildDeck(), mulberry32(seed));
  const piles: Card[][] = Array.from({ length: TABLEAU_PILES }, () => []);
  let next = 0;
  // Round r gives one card to each pile p >= r.
  for (let r = 0; r < TABLEAU_PILES; r++) {
    for (let p = r; p < TABLEAU_PILES; p++) {
      const card = deck[next++] as Card;
      (piles[p] as Card[]).push(withFace(card, p === r));
    }
  }
  const stock = deck.slice(next).map((c) => withFace(c, false));
  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau: piles as unknown as Board['tableau'],
  };
}

/** A fresh game. New game and restart are store concerns (they touch the Vegas ledger); they call this. */
export function newGame(seed: number, mode: GameMode): GameState {
  return {
    seed: seed >>> 0,
    mode,
    board: dealBoard(seed),
    moves: 0,
    status: 'playing',
    classic: { points: 0, undoPenalty: 0 },
    vegas: { credited: [], everPaid: [] },
    undo: { used: 0, history: [] },
  };
}
