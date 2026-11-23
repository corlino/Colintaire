import { describe, expect, it } from 'vitest';
import { assertInvariants, dealBoard, newGame } from '../../src/engine';

describe('deal (PRD 5.2, AC 1)', () => {
  it('deals 1..7 cards to the tableau with only the top card face up', () => {
    const board = dealBoard(12345);
    board.tableau.forEach((pile, p) => {
      expect(pile).toHaveLength(p + 1);
      pile.forEach((card, i) => expect(card.faceUp).toBe(i === p));
    });
  });

  it('puts the remaining 24 cards face down in the stock and leaves foundations empty', () => {
    const board = dealBoard(999);
    expect(board.stock).toHaveLength(24);
    expect(board.stock.every((c) => !c.faceUp)).toBe(true);
    expect(board.waste).toHaveLength(0);
    expect(board.foundations.every((f) => f.length === 0)).toBe(true);
  });

  it('uses all 52 unique cards and passes invariants', () => {
    for (const seed of [0, 1, 42, 0xffffffff, 123456789]) assertInvariants(newGame(seed, 'classic'));
  });

  it('is deterministic per seed and differs between seeds (FR-19)', () => {
    expect(dealBoard(7)).toEqual(dealBoard(7));
    expect(dealBoard(7)).not.toEqual(dealBoard(8));
  });

  it('initialises stats, score and undo allowance', () => {
    const g = newGame(5, 'vegas');
    expect(g.moves).toBe(0);
    expect(g.status).toBe('playing');
    expect(g.undo).toEqual({ used: 0, history: [] });
    expect(g.vegas).toEqual({ credited: [], everPaid: [] });
  });
});

describe('invariant guard (NFR Reliability)', () => {
  it('catches lost, duplicated and mis-faced cards', () => {
    const g = newGame(1, 'classic');
    const lost = { ...g, board: { ...g.board, stock: g.board.stock.slice(1) } };
    expect(() => assertInvariants(lost)).toThrow(/52 cards/);
    const dup = { ...g, board: { ...g.board, stock: [...g.board.stock.slice(1), g.board.tableau[0][0]!] } };
    expect(() => assertInvariants(dup)).toThrow(/duplicate/);
    const faceUpStock = { ...g, board: { ...g.board, stock: g.board.stock.map((c) => ({ ...c, faceUp: true })) } };
    expect(() => assertInvariants(faceUpStock)).toThrow(/stock/);
  });
});
