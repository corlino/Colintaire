import {
  applyAction,
  assertInvariants,
  buildDeck,
  canUndo,
  isLegalMove,
  newGame,
  type Action,
  type Board,
  type Card,
  type GameMode,
  type GameState,
  type PileRef,
  type Rank,
  type Suit,
} from '../src/engine';

/** Parse "S01" / "h13" style tokens. Uppercase suit = face up, lowercase = face down. */
export function c(token: string): Card {
  const suitChar = token[0] as string;
  const suit = suitChar.toUpperCase() as Suit;
  const rank = Number(token.slice(1)) as Rank;
  return { id: `${suit}${rank.toString().padStart(2, '0')}`, suit, rank, faceUp: suitChar === suitChar.toUpperCase() };
}
export const cs = (...tokens: string[]): Card[] => tokens.map(c);

export const T = (index: number): PileRef => ({ kind: 'tableau', index });
export const F = (index: number): PileRef => ({ kind: 'foundation', index });
export const W: PileRef = { kind: 'waste' };
export const S: PileRef = { kind: 'stock' };

/** Build a state from a partial board. Not necessarily 52 cards — for targeted rule tests only. */
export function stateWith(partial: Partial<Board>, mode: GameMode = 'classic'): GameState {
  const base = newGame(1, mode);
  const board: Board = {
    stock: partial.stock ?? [],
    waste: partial.waste ?? [],
    foundations: partial.foundations ?? [[], [], [], []],
    tableau: partial.tableau ?? [[], [], [], [], [], [], []],
  };
  return { ...base, board };
}

/**
 * A full, valid 52-card state where every tableau pile is empty and drawing
 * from the stock yields ♠A..♠K, ♥A..♥K, ♣A..♣K, ♦A..♦K in order. Each draw can
 * go straight to a foundation, which makes scoring scenarios easy to script.
 */
export function orderedStockState(mode: GameMode): GameState {
  const deck = buildDeck(); // S, H, C, D order, Ace..King, face down
  return stateWith({ stock: [...deck].reverse() }, mode);
}

/** Draw and send the next card to its foundation, n times. */
export function depositNext(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = ok(applyAction(s, { type: 'DRAW' }));
    const card = s.board.waste[s.board.waste.length - 1] as Card;
    const slot = ['S', 'H', 'C', 'D'].indexOf(card.suit);
    s = ok(applyAction(s, { type: 'MOVE', from: W, cardIndex: s.board.waste.length - 1, to: F(slot) }));
  }
  return s;
}

export function ok(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.state;
}

/** Every legal action in this state, including UNDO when available. */
export function legalActions(state: GameState): Action[] {
  if (state.status === 'won') return [];
  const actions: Action[] = [];
  const { board } = state;
  if (board.stock.length > 0) actions.push({ type: 'DRAW' });
  else if (board.waste.length > 0) actions.push({ type: 'RECYCLE' });
  if (canUndo(state)) actions.push({ type: 'UNDO' });
  if (state.mode === 'trini' && board.tableau.some((p) => p.length > 0)) actions.push({ type: 'RESHUFFLE', seed: state.moves });

  const sources: { ref: PileRef; length: number }[] = [
    { ref: W, length: board.waste.length },
    ...board.foundations.map((f, i) => ({ ref: F(i), length: f.length })),
    ...board.tableau.map((p, i) => ({ ref: T(i), length: p.length })),
  ];
  const targets: PileRef[] = [...board.foundations.map((_, i) => F(i)), ...board.tableau.map((_, i) => T(i))];
  for (const { ref, length } of sources) {
    for (let idx = 0; idx < length; idx++) {
      for (const to of targets) {
        if (isLegalMove(board, ref, idx, to)) actions.push({ type: 'MOVE', from: ref, cardIndex: idx, to });
      }
    }
  }
  return actions;
}

export { assertInvariants };
