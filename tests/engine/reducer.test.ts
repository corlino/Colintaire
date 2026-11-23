import { describe, expect, it } from 'vitest';
import {
  applyAction,
  assertInvariants,
  canUndo,
  classicScore,
  gameNet,
  newGame,
  undosLeft,
  type GameState,
} from '../../src/engine';
import { cs, depositNext, F, ok, orderedStockState, stateWith, T, W } from '../helpers';

const DRAW = { type: 'DRAW' } as const;
const RECYCLE = { type: 'RECYCLE' } as const;
const UNDO = { type: 'UNDO' } as const;

describe('moves and auto-flip (PRD 4.3, AC 7)', () => {
  it('reveals the face-down card left on top, in the same action', () => {
    const s = stateWith({ tableau: [cs('d05', 'S09'), cs('H10'), [], [], [], [], []] });
    const r = applyAction(s, { type: 'MOVE', from: T(0), cardIndex: 1, to: T(1) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.board.tableau[0]).toEqual(cs('D05'));
    expect(r.state.board.tableau[1]).toEqual(cs('H10', 'S09'));
    expect(r.events.map((e) => e.type)).toEqual(['MOVED', 'FLIP']);
    expect(r.state.moves).toBe(1);
  });

  it('keeps logical order when a run moves between piles (AC 5)', () => {
    const s = stateWith({ tableau: [cs('S09', 'H08', 'C07'), [], [], [], [], cs('D10'), []] });
    const next = ok(applyAction(s, { type: 'MOVE', from: T(0), cardIndex: 0, to: T(5) }));
    expect(next.board.tableau[5]).toEqual(cs('D10', 'S09', 'H08', 'C07'));
  });

  it('rejects invalid moves without changing state (AC 6)', () => {
    const s = stateWith({ tableau: [cs('S09'), cs('C10'), [], [], [], [], []] });
    const r = applyAction(s, { type: 'MOVE', from: T(0), cardIndex: 0, to: T(1) });
    expect(r).toEqual({ ok: false, error: 'INVALID_MOVE' });
  });

  it('does not mutate the input state', () => {
    const s = newGame(77, 'classic');
    const frozen = JSON.stringify(s);
    applyAction(s, DRAW);
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe('stock and waste (PRD 4.4, 5.5, AC 8–10)', () => {
  it('deals exactly one card per draw, face up on the waste', () => {
    const s = newGame(3, 'classic');
    const next = ok(applyAction(s, DRAW));
    expect(next.board.stock).toHaveLength(23);
    expect(next.board.waste).toHaveLength(1);
    expect(next.board.waste[0]?.faceUp).toBe(true);
    expect(next.board.waste[0]?.id).toBe(s.board.stock[23]?.id);
  });

  it('only recycles when the stock is empty, and refuses to draw from an empty stock', () => {
    const s = newGame(3, 'classic');
    expect(applyAction(s, RECYCLE)).toEqual({ ok: false, error: 'STOCK_NOT_EMPTY' });
    const empty = stateWith({});
    expect(applyAction(empty, DRAW)).toEqual({ ok: false, error: 'EMPTY_STOCK' });
    expect(applyAction(empty, RECYCLE)).toEqual({ ok: false, error: 'EMPTY_WASTE' });
  });

  it('preserves draw order across unlimited recycles', () => {
    let s: GameState = newGame(11, 'classic');
    const drawOrder = (state: GameState): [string[], GameState] => {
      const ids: string[] = [];
      while (state.board.stock.length) {
        state = ok(applyAction(state, DRAW));
        ids.push(state.board.waste[state.board.waste.length - 1]!.id);
      }
      return [ids, state];
    };
    const [first, afterFirst] = drawOrder(s);
    s = afterFirst;
    for (let pass = 0; pass < 5; pass++) {
      s = ok(applyAction(s, RECYCLE));
      expect(s.board.stock.every((c) => !c.faceUp)).toBe(true);
      const [again, after] = drawOrder(s);
      expect(again).toEqual(first);
      s = after;
    }
    assertInvariants(s);
  });

  it('counts draw and recycle as moves (U6)', () => {
    let s = stateWith({ stock: cs('s01') });
    s = ok(applyAction(s, DRAW));
    s = ok(applyAction(s, RECYCLE));
    expect(s.moves).toBe(2);
  });
});

describe('Classic scoring (U1, U8)', () => {
  it('scores each move type from the table', () => {
    // waste → tableau +5
    let s = stateWith({ waste: cs('H08'), tableau: [cs('S09'), [], [], [], [], [], []] });
    expect(ok(applyAction(s, { type: 'MOVE', from: W, cardIndex: 0, to: T(0) })).classic.points).toBe(5);
    // waste → foundation +10
    s = stateWith({ waste: cs('S01') });
    expect(ok(applyAction(s, { type: 'MOVE', from: W, cardIndex: 0, to: F(0) })).classic.points).toBe(10);
    // tableau → foundation +10, plus turn-over +5
    s = stateWith({ tableau: [cs('c04', 'S01'), [], [], [], [], [], []] });
    expect(ok(applyAction(s, { type: 'MOVE', from: T(0), cardIndex: 1, to: F(0) })).classic.points).toBe(15);
    // foundation → tableau −15
    s = stateWith({ foundations: [[], cs('H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07'), [], []], tableau: [cs('S08'), [], [], [], [], [], []] });
    s = { ...s, classic: { points: 20, undoPenalty: 0 } };
    expect(ok(applyAction(s, { type: 'MOVE', from: F(1), cardIndex: 6, to: T(0) })).classic.points).toBe(5);
  });

  it('floors the displayed score at 0', () => {
    const s = stateWith({});
    expect(classicScore({ ...s, classic: { points: 5, undoPenalty: 15 } })).toBe(0);
    expect(classicScore({ ...s, classic: { points: 40, undoPenalty: 10 } })).toBe(30);
  });
});

describe('undo (PRD 5.9, AC 13, 14, 17)', () => {
  it('restores board, flip and move count, and charges 5 points that undo cannot reverse', () => {
    const start = stateWith({ tableau: [cs('d05', 'S09'), cs('H10'), [], [], [], [], []], waste: cs('S01') });
    let s = ok(applyAction(start, { type: 'MOVE', from: W, cardIndex: 0, to: F(0) })); // +10
    s = ok(applyAction(s, { type: 'MOVE', from: T(0), cardIndex: 1, to: T(1) })); // +5 flip
    expect(s.classic.points).toBe(15);
    expect(s.moves).toBe(2);

    s = ok(applyAction(s, UNDO));
    expect(s.board.tableau[0]).toEqual(cs('d05', 'S09'));
    expect(s.moves).toBe(1);
    expect(s.classic).toEqual({ points: 10, undoPenalty: 5 });
    expect(classicScore(s)).toBe(5);

    s = ok(applyAction(s, UNDO));
    expect(s.board).toEqual(start.board);
    expect(s.classic).toEqual({ points: 0, undoPenalty: 10 });
  });

  it('allows three undos per game, then disables', () => {
    let s = newGame(21, 'classic');
    for (let i = 0; i < 5; i++) s = ok(applyAction(s, DRAW));
    for (let i = 0; i < 3; i++) {
      expect(canUndo(s)).toBe(true);
      s = ok(applyAction(s, UNDO));
    }
    expect(undosLeft(s)).toBe(0);
    expect(canUndo(s)).toBe(false);
    expect(applyAction(s, UNDO)).toEqual({ ok: false, error: 'NO_UNDO' });
    // New moves do not restore the allowance.
    s = ok(applyAction(s, DRAW));
    expect(applyAction(s, UNDO)).toEqual({ ok: false, error: 'NO_UNDO' });
  });

  it('has nothing to undo at the start of a game', () => {
    expect(applyAction(newGame(1, 'classic'), UNDO)).toEqual({ ok: false, error: 'NO_UNDO' });
  });

  it('undoes a recycle and does not reset the allowance on recycle (PRD 5.5)', () => {
    let s = stateWith({ stock: cs('s01', 's02') });
    s = ok(applyAction(s, DRAW));
    s = ok(applyAction(s, DRAW));
    s = ok(applyAction(s, UNDO));
    s = ok(applyAction(s, DRAW));
    s = ok(applyAction(s, RECYCLE));
    expect(s.undo.used).toBe(1);
    s = ok(applyAction(s, UNDO));
    expect(s.board.stock).toHaveLength(0);
    expect(s.board.waste).toHaveLength(2);
  });
});

describe('Vegas payouts (PRD 6.2, FR-16/17, AC 15–16, 22)', () => {
  it('pays $5 per card into a foundation', () => {
    const s = depositNext(orderedStockState('vegas'), 11);
    expect(s.vegas.credited).toHaveLength(11);
    expect(gameNet(s)).toBe(3); // break-even example: 11 cards = +$3
    expect(gameNet(depositNext(orderedStockState('vegas'), 10))).toBe(-2);
  });

  it('undo reverses the payout and the card can never pay again this game', () => {
    let s = depositNext(orderedStockState('vegas'), 1);
    expect(gameNet(s)).toBe(-47);
    s = ok(applyAction(s, UNDO));
    expect(gameNet(s)).toBe(-52);
    expect(s.vegas.everPaid).toEqual(['S01']);
    s = ok(applyAction(s, { type: 'MOVE', from: W, cardIndex: 0, to: F(0) }));
    expect(s.board.foundations[0]).toHaveLength(1);
    expect(gameNet(s)).toBe(-52);
  });

  it('keeps the $5 when a card is moved out by hand, and pays nothing when it returns (U5)', () => {
    let s = stateWith(
      { waste: cs('H01', 'H02'), tableau: [cs('S03'), [], [], [], [], [], []], foundations: [[], [], [], []] },
      'vegas',
    );
    s = ok(applyAction(s, { type: 'MOVE', from: W, cardIndex: 1, to: T(0) })); // H02 on S03
    s = ok(applyAction(s, { type: 'MOVE', from: W, cardIndex: 0, to: F(1) })); // H01 → +$5
    s = ok(applyAction(s, { type: 'MOVE', from: T(0), cardIndex: 1, to: F(1) })); // H02 → +$5
    expect(gameNet(s)).toBe(-42);
    s = ok(applyAction(s, { type: 'MOVE', from: F(1), cardIndex: 1, to: T(0) })); // out by hand
    expect(gameNet(s)).toBe(-42);
    s = ok(applyAction(s, { type: 'MOVE', from: T(0), cardIndex: 1, to: F(1) })); // back again
    expect(gameNet(s)).toBe(-42);
    expect(s.vegas.everPaid).toEqual(['H01', 'H02']);
  });

  it('applies no fixed penalty to Vegas undo beyond the reversed payout', () => {
    let s = newGame(9, 'vegas');
    s = ok(applyAction(s, DRAW));
    s = ok(applyAction(s, UNDO));
    expect(gameNet(s)).toBe(-52);
  });

  it('never pays in Classic mode', () => {
    const s = depositNext(orderedStockState('classic'), 5);
    expect(s.vegas.credited).toHaveLength(0);
  });
});

describe('win detection (PRD 5.7, AC 11)', () => {
  it('wins when all 52 cards reach the foundations and then freezes the game', () => {
    const s = depositNext(orderedStockState('vegas'), 52);
    expect(s.status).toBe('won');
    expect(gameNet(s)).toBe(208); // maximum net
    assertInvariants(s);
    expect(applyAction(s, UNDO)).toEqual({ ok: false, error: 'GAME_OVER' });
    expect(applyAction(s, { type: 'MOVE', from: F(0), cardIndex: 12, to: T(0) })).toEqual({ ok: false, error: 'GAME_OVER' });
  });
});
