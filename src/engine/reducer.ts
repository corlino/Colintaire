/**
 * applyAction(state, action) → Result. The only place rules, scoring and undo
 * change state (TAD §7–8). Pure and immutable: the input state is never mutated.
 */
import { withFace } from './cards';
import { CLASSIC_POINTS, UNDO_LIMIT, VEGAS } from './constants';
import { mulberry32, shuffle } from './rng';
import { isLegalMove, pileAt } from './rules';
import type { Action, Board, Card, GameEvent, GameState, Pile, PileRef, Result, Snapshot } from './types';

export function applyAction(state: GameState, action: Action): Result {
  if (state.status === 'won') return { ok: false, error: 'GAME_OVER' };
  switch (action.type) {
    case 'MOVE':
      return move(state, action.from, action.cardIndex, action.to);
    case 'DRAW':
      return draw(state);
    case 'RECYCLE':
      return recycle(state);
    case 'UNDO':
      return undo(state);
    case 'RESHUFFLE':
      return reshuffle(state, action.seed);
  }
}

// ---------------------------------------------------------------- helpers

function takeSnapshot(state: GameState): Snapshot {
  return {
    board: state.board,
    moves: state.moves,
    classicPoints: state.classic.points,
    credited: state.vegas.credited,
    status: state.status,
  };
}

function pushHistory(state: GameState): GameState['undo'] {
  const history = [...state.undo.history, takeSnapshot(state)].slice(-UNDO_LIMIT);
  return { used: state.undo.used, history };
}

function setPile(board: Board, ref: PileRef, pile: Pile): Board {
  switch (ref.kind) {
    case 'stock':
      return { ...board, stock: pile };
    case 'waste':
      return { ...board, waste: pile };
    case 'foundation': {
      const foundations = [...board.foundations] as unknown as Pile[];
      foundations[ref.index] = pile;
      return { ...board, foundations: foundations as unknown as Board['foundations'] };
    }
    case 'tableau': {
      const tableau = [...board.tableau] as unknown as Pile[];
      tableau[ref.index] = pile;
      return { ...board, tableau: tableau as unknown as Board['tableau'] };
    }
  }
}

function isWon(board: Board): boolean {
  return board.foundations.every((f) => f.length === 13);
}

function classicDelta(from: PileRef, to: PileRef): number {
  if (from.kind === 'waste' && to.kind === 'tableau') return CLASSIC_POINTS.wasteToTableau;
  if (from.kind === 'waste' && to.kind === 'foundation') return CLASSIC_POINTS.wasteToFoundation;
  if (from.kind === 'tableau' && to.kind === 'foundation') return CLASSIC_POINTS.tableauToFoundation;
  if (from.kind === 'foundation' && to.kind === 'tableau') return CLASSIC_POINTS.foundationToTableau;
  return 0;
}

function finish(state: GameState, events: GameEvent[]): Result {
  if (isWon(state.board)) {
    return { ok: true, state: { ...state, status: 'won' }, events: [...events, { type: 'WON' }] };
  }
  return { ok: true, state, events };
}

// ---------------------------------------------------------------- actions

function move(state: GameState, from: PileRef, cardIndex: number, to: PileRef): Result {
  const { board } = state;
  if (!isLegalMove(board, from, cardIndex, to)) return { ok: false, error: 'INVALID_MOVE' };

  const source = pileAt(board, from) as Pile;
  const target = pileAt(board, to) as Pile;
  const moving = source.slice(cardIndex);
  let remaining: Pile = source.slice(0, cardIndex);
  const events: GameEvent[] = [{ type: 'MOVED', cardIds: moving.map((c) => c.id), from, to }];
  let points = state.classic.points + classicDelta(from, to);

  // Auto-flip: a face-down card left on top of a tableau pile turns over in the same action.
  const newTop = remaining[remaining.length - 1];
  if (from.kind === 'tableau' && newTop && !newTop.faceUp) {
    remaining = [...remaining.slice(0, -1), withFace(newTop, true)];
    points += CLASSIC_POINTS.turnOver;
    events.push({ type: 'FLIP', cardId: newTop.id, pile: from.index });
  }

  let nextBoard = setPile(board, from, remaining);
  nextBoard = setPile(nextBoard, to, [...target, ...moving]);

  // Vegas payout: once per card per game (FR-17, PRD 6.2).
  let vegas = state.vegas;
  if (state.mode === 'vegas' && to.kind === 'foundation') {
    const card = moving[0] as Card;
    if (!vegas.everPaid.includes(card.id)) {
      vegas = { credited: [...vegas.credited, card.id], everPaid: [...vegas.everPaid, card.id] };
      events.push({ type: 'PAYOUT', cardId: card.id, amount: VEGAS.payout });
    }
  }

  return finish(
    {
      ...state,
      board: nextBoard,
      moves: state.moves + 1,
      classic: { ...state.classic, points },
      vegas,
      undo: pushHistory(state),
    },
    events,
  );
}

function draw(state: GameState): Result {
  const { stock, waste } = state.board;
  const top = stock[stock.length - 1];
  if (!top) return { ok: false, error: 'EMPTY_STOCK' };
  const drawn = withFace(top, true);
  return {
    ok: true,
    state: {
      ...state,
      board: { ...state.board, stock: stock.slice(0, -1), waste: [...waste, drawn] },
      moves: state.moves + 1,
      undo: pushHistory(state),
    },
    events: [{ type: 'DREW', cardId: drawn.id }],
  };
}

/** stock = waste reversed, face down. Drawing then deals cards in their first-pass order (PRD 4.4). */
function recycle(state: GameState): Result {
  const { stock, waste } = state.board;
  if (stock.length > 0) return { ok: false, error: 'STOCK_NOT_EMPTY' };
  if (waste.length === 0) return { ok: false, error: 'EMPTY_WASTE' };
  const newStock = [...waste].reverse().map((c) => withFace(c, false));
  return {
    ok: true,
    state: {
      ...state,
      board: { ...state.board, stock: newStock, waste: [] },
      moves: state.moves + 1,
      undo: pushHistory(state),
    },
    events: [{ type: 'RECYCLED' }],
  };
}

/**
 * Restore the last snapshot. undo.used, classic.undoPenalty and vegas.everPaid
 * are deliberately outside the snapshot, so undo can never reverse them (PRD 5.9).
 */
function undo(state: GameState): Result {
  const snap = state.undo.history[state.undo.history.length - 1];
  if (!snap || state.undo.used >= UNDO_LIMIT) return { ok: false, error: 'NO_UNDO' };
  return {
    ok: true,
    state: {
      ...state,
      board: snap.board,
      moves: snap.moves,
      status: snap.status,
      classic: { points: snap.classicPoints, undoPenalty: state.classic.undoPenalty + CLASSIC_POINTS.undoPenalty },
      vegas: { credited: snap.credited, everPaid: state.vegas.everPaid },
      undo: { used: state.undo.used + 1, history: state.undo.history.slice(0, -1) },
    },
    events: [{ type: 'UNDONE' }],
  };
}

/**
 * Trini mode: gather every tableau card, shuffle, and deal them back so each pile keeps
 * its size, with only the top card face up. Stock, waste and foundations are untouched.
 * It counts as a move and scores nothing. It cannot be undone, and it clears the undo
 * history so earlier moves can't be undone past it (owner decision); undos already used stay used.
 */
function reshuffle(state: GameState, seed: number): Result {
  if (state.mode !== 'trini') return { ok: false, error: 'WRONG_MODE' };
  const cards = state.board.tableau.flat();
  if (cards.length === 0) return { ok: false, error: 'EMPTY_TABLEAU' };
  const deck = shuffle([...cards], mulberry32(seed));
  let next = 0;
  const tableau = state.board.tableau.map((pile) =>
    pile.map((_, i) => withFace(deck[next++] as Card, i === pile.length - 1)),
  ) as unknown as Board['tableau'];
  return {
    ok: true,
    state: {
      ...state,
      board: { ...state.board, tableau },
      moves: state.moves + 1,
      undo: { used: state.undo.used, history: [] },
    },
    events: [{ type: 'RESHUFFLED' }],
  };
}
