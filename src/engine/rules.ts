/**
 * Move legality (TAD §7.3). Rules use only suit, rank and face state —
 * never screen position — which is how PRD 4.3 is met.
 */
import { colorOf, foundationIndexFor } from './cards';
import { FOUNDATION_SUITS, TABLEAU_PILES } from './constants';
import type { Board, Card, Pile, PileRef } from './types';

/** Can `card` be placed on a tableau pile whose current contents are `target`? */
export function canPlaceOnTableau(card: Card, target: Pile): boolean {
  const top = target[target.length - 1];
  if (!top) return card.rank === 13;
  return top.faceUp && colorOf(top.suit) !== colorOf(card.suit) && top.rank === card.rank + 1;
}

/** Can `card` be placed on foundation slot `index`? */
export function canPlaceOnFoundation(card: Card, index: number, foundation: Pile): boolean {
  return FOUNDATION_SUITS[index] === card.suit && card.rank === foundation.length + 1;
}

/** Is `cards` a face-up run that alternates colour and descends by one each step? */
export function isValidRun(cards: Pile): boolean {
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i] as Card;
    if (!c.faceUp) return false;
    if (i > 0) {
      const prev = cards[i - 1] as Card;
      if (colorOf(prev.suit) === colorOf(c.suit) || prev.rank !== c.rank + 1) return false;
    }
  }
  return true;
}

export function pileAt(board: Board, ref: PileRef): Pile | undefined {
  switch (ref.kind) {
    case 'stock':
      return board.stock;
    case 'waste':
      return board.waste;
    case 'foundation':
      return board.foundations[ref.index as 0];
    case 'tableau':
      return board.tableau[ref.index as 0];
  }
}

export function sameRef(a: PileRef, b: PileRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'foundation' || a.kind === 'tableau') return a.index === (b as typeof a).index;
  return true;
}

function validRef(ref: PileRef): boolean {
  if (ref.kind === 'foundation') return Number.isInteger(ref.index) && ref.index >= 0 && ref.index < 4;
  if (ref.kind === 'tableau') return Number.isInteger(ref.index) && ref.index >= 0 && ref.index < TABLEAU_PILES;
  return true;
}

/** Can cards from `cardIndex` to the top of `from` be picked up as a unit? */
export function canPickUp(board: Board, from: PileRef, cardIndex: number): boolean {
  if (!validRef(from)) return false;
  const pile = pileAt(board, from);
  if (!pile || cardIndex < 0 || cardIndex >= pile.length) return false;
  switch (from.kind) {
    case 'stock':
      return false;
    case 'waste':
    case 'foundation':
      return cardIndex === pile.length - 1;
    case 'tableau':
      return isValidRun(pile.slice(cardIndex));
  }
}

/** Full legality check for a MOVE. */
export function isLegalMove(board: Board, from: PileRef, cardIndex: number, to: PileRef): boolean {
  if (!validRef(to) || sameRef(from, to)) return false;
  if (!canPickUp(board, from, cardIndex)) return false;
  const source = pileAt(board, from) as Pile;
  const moving = source.slice(cardIndex);
  const lead = moving[0] as Card;

  switch (to.kind) {
    case 'stock':
    case 'waste':
      return false;
    case 'foundation':
      if (from.kind === 'foundation') return false;
      return moving.length === 1 && canPlaceOnFoundation(lead, to.index, board.foundations[to.index as 0]);
    case 'tableau':
      return canPlaceOnTableau(lead, board.tableau[to.index as 0]);
  }
}

/** The foundation slot this card would go to by double-tap, if that move is legal. */
export function autoFoundationTarget(board: Board, from: PileRef, cardIndex: number): PileRef | null {
  const pile = pileAt(board, from);
  const card = pile?.[cardIndex];
  if (!card) return null;
  const to: PileRef = { kind: 'foundation', index: foundationIndexFor(card.suit) };
  return isLegalMove(board, from, cardIndex, to) ? to : null;
}
