/**
 * assertInvariants(state) — run after every action in development and in all
 * tests (TAD §7.6). Throws on the first violation.
 */
import { FOUNDATION_SUITS, UNDO_LIMIT } from './constants';
import { isValidRun } from './rules';
import type { Card, GameState } from './types';

export class InvariantError extends Error {}

function fail(msg: string): never {
  throw new InvariantError(msg);
}

export function assertInvariants(state: GameState): void {
  const { board } = state;
  const all: Card[] = [
    ...board.stock,
    ...board.waste,
    ...board.foundations.flat(),
    ...board.tableau.flat(),
  ];
  if (all.length !== 52) fail(`expected 52 cards, found ${all.length}`);
  const ids = new Set(all.map((c) => c.id));
  if (ids.size !== 52) fail('duplicate card ids');

  if (board.stock.some((c) => c.faceUp)) fail('face-up card in stock');
  if (board.waste.some((c) => !c.faceUp)) fail('face-down card in waste');

  board.foundations.forEach((f, i) => {
    f.forEach((c, r) => {
      if (!c.faceUp) fail(`face-down card in foundation ${i}`);
      if (c.suit !== FOUNDATION_SUITS[i]) fail(`wrong suit in foundation ${i}`);
      if (c.rank !== r + 1) fail(`foundation ${i} out of order`);
    });
  });

  board.tableau.forEach((pile, p) => {
    const firstUp = pile.findIndex((c) => c.faceUp);
    if (pile.length > 0 && firstUp === -1) fail(`tableau ${p} has no face-up top card`);
    if (firstUp >= 0) {
      if (pile.slice(0, firstUp).some((c) => c.faceUp)) fail(`tableau ${p} face states out of order`);
      if (!isValidRun(pile.slice(firstUp))) fail(`tableau ${p} face-up cards are not a valid run`);
    }
  });

  if (state.undo.used < 0 || state.undo.used > UNDO_LIMIT) fail('undo.used out of range');
  if (state.undo.history.length > UNDO_LIMIT) fail('undo history too long');
  if (state.moves < 0) fail('negative moves');

  const paid = new Set(state.vegas.everPaid);
  if (paid.size !== state.vegas.everPaid.length) fail('duplicate everPaid');
  if (new Set(state.vegas.credited).size !== state.vegas.credited.length) fail('duplicate credited');
  for (const id of state.vegas.credited) if (!paid.has(id)) fail('credited card never paid');
  if (state.mode !== 'vegas' && state.vegas.everPaid.length > 0) fail(`payout in ${state.mode} mode`);

  const won = board.foundations.every((f) => f.length === 13);
  if (won !== (state.status === 'won')) fail('status does not match foundations');
}
