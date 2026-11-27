import { describe, expect, it } from 'vitest';
import { applyAction, assertInvariants, canUndo, classicScore, newGame, type Card, type GameState } from '../../src/engine';
import { cs, depositNext, ok, orderedStockState, stateWith } from '../helpers';

const RESHUFFLE = (seed = 7) => ({ type: 'RESHUFFLE', seed }) as const;
const ids = (cards: readonly Card[]) => cards.map((c) => c.id).sort();

/** A Trini game a few moves in: some cards turned over, a card on a foundation, cards in the waste. */
function trini(): GameState {
  let s = newGame(42, 'trini');
  s = ok(applyAction(s, { type: 'DRAW' }));
  s = ok(applyAction(s, { type: 'DRAW' }));
  return s;
}

describe('Trini reshuffle (owner request)', () => {
  it('shuffles only the tableau, keeping each pile its size with just the top card face up', () => {
    const before = trini();
    const after = ok(applyAction(before, RESHUFFLE()));
    assertInvariants(after);
    const sizes = (s: GameState) => s.board.tableau.map((p) => p.length);
    expect(sizes(after)).toEqual(sizes(before));
    expect(ids(after.board.tableau.flat())).toEqual(ids(before.board.tableau.flat()));
    for (const pile of after.board.tableau) {
      pile.forEach((card, i) => expect(card.faceUp).toBe(i === pile.length - 1));
    }
    expect(after.board.stock).toBe(before.board.stock);
    expect(after.board.waste).toBe(before.board.waste);
    expect(after.board.foundations).toBe(before.board.foundations);
    expect(after.board.tableau.flat().map((c) => c.id)).not.toEqual(before.board.tableau.flat().map((c) => c.id));
  });

  it('turns cards that were face up face down again, and leaves empty piles empty', () => {
    const s = stateWith({ tableau: [cs('d05', 'S09', 'H08'), [], cs('C13'), [], [], [], []] }, 'trini');
    const after = ok(applyAction(s, RESHUFFLE()));
    expect(after.board.tableau[0]).toHaveLength(3);
    expect(after.board.tableau[0]!.filter((c) => c.faceUp)).toHaveLength(1);
    expect(after.board.tableau[1]).toEqual([]);
    expect(after.board.tableau[2]).toHaveLength(1);
    expect(after.board.tableau[2]![0]!.faceUp).toBe(true);
  });

  it('is the same for the same seed and differs for another', () => {
    const s = trini();
    const a = ok(applyAction(s, RESHUFFLE(1))).board.tableau;
    expect(ok(applyAction(s, RESHUFFLE(1))).board.tableau).toEqual(a);
    expect(ok(applyAction(s, RESHUFFLE(2))).board.tableau).not.toEqual(a);
  });

  it('keeps the moves, score and time going: counts as one move, scores nothing', () => {
    let s = depositNext(orderedStockState('trini'), 1); // ♠A on its foundation
    s = { ...s, board: { ...s.board, tableau: [cs('d05', 'H09'), cs('C10'), [], [], [], [], []] as unknown as GameState['board']['tableau'], stock: s.board.stock.slice(0, -2), waste: [] } };
    const before = { moves: s.moves, score: classicScore(s) };
    const after = ok(applyAction(s, RESHUFFLE()));
    expect(after.moves).toBe(before.moves + 1);
    expect(classicScore(after)).toBe(before.score);
    expect(after.board.foundations[0]).toEqual(s.board.foundations[0]);
  });

  it('cannot be undone, and moves before it cannot be undone either', () => {
    const before = ok(applyAction(trini(), { type: 'DRAW' }));
    expect(canUndo(before)).toBe(true);
    const after = ok(applyAction(before, RESHUFFLE()));
    expect(canUndo(after)).toBe(false);
    expect(applyAction(after, { type: 'UNDO' })).toEqual({ ok: false, error: 'NO_UNDO' });
    expect(after.undo.used).toBe(before.undo.used); // no undo spent
    // A move after the reshuffle can still be undone, back to the reshuffled board only.
    const drawn = ok(applyAction(after, { type: 'DRAW' }));
    const undone = ok(applyAction(drawn, { type: 'UNDO' }));
    expect(undone.board).toEqual(after.board);
    expect(canUndo(undone)).toBe(false);
  });

  it('can be done again and again', () => {
    let s = trini();
    for (let i = 0; i < 20; i++) {
      s = ok(applyAction(s, RESHUFFLE(i)));
      assertInvariants(s);
    }
    expect(s.moves).toBe(2 + 20);
  });

  it('is only allowed in Trini mode, with tableau cards, while playing', () => {
    expect(applyAction(newGame(42, 'classic'), RESHUFFLE())).toEqual({ ok: false, error: 'WRONG_MODE' });
    expect(applyAction(newGame(42, 'vegas'), RESHUFFLE())).toEqual({ ok: false, error: 'WRONG_MODE' });
    expect(applyAction(stateWith({ waste: cs('S01') }, 'trini'), RESHUFFLE())).toEqual({ ok: false, error: 'EMPTY_TABLEAU' });
    const won = { ...trini(), status: 'won' as const };
    expect(applyAction(won, RESHUFFLE())).toEqual({ ok: false, error: 'GAME_OVER' });
  });

  it('reports what happened', () => {
    const r = applyAction(trini(), RESHUFFLE());
    expect(r.ok && r.events).toEqual([{ type: 'RESHUFFLED' }]);
  });

  it('Trini scores like Classic and never pays out', () => {
    const s = depositNext(orderedStockState('trini'), 3);
    expect(classicScore(s)).toBe(classicScore(depositNext(orderedStockState('classic'), 3)));
    expect(s.vegas.everPaid).toEqual([]);
  });
});
