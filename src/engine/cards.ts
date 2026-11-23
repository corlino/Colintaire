import { FOUNDATION_SUITS, SUITS } from './constants';
import type { Card, CardId, Color, Rank, Suit } from './types';

export function cardId(suit: Suit, rank: Rank): CardId {
  return `${suit}${rank.toString().padStart(2, '0')}`;
}

export function colorOf(suit: Suit): Color {
  return suit === 'H' || suit === 'D' ? 'red' : 'black';
}

/** The foundation slot a suit belongs to (decision U7). */
export function foundationIndexFor(suit: Suit): number {
  return FOUNDATION_SUITS.indexOf(suit);
}

/** All 52 cards in a fixed order (♠ ♥ ♣ ♦, Ace to King), face down. */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let r = 1; r <= 13; r++) {
      const rank = r as Rank;
      deck.push({ id: cardId(suit, rank), suit, rank, faceUp: false });
    }
  }
  return deck;
}

export function withFace(card: Card, faceUp: boolean): Card {
  return card.faceUp === faceUp ? card : { ...card, faceUp };
}
