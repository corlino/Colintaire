import { describe, expect, it } from 'vitest';
import { classicScore, newGame } from '../../src/engine';
import {
  confirmNewGame,
  EMPTY_LEDGER,
  resetVegasBalance,
  restart,
  vegasBalance,
  type Session,
} from '../../src/store/session';
import { depositNext, orderedStockState } from '../helpers';
import { applyAction } from '../../src/engine';

/** Swap in a scripted deal so foundation deposits are easy, keeping the session's ledger. */
const scripted = (s: Session): Session => ({ ...s, game: orderedStockState(s.game.mode) });

describe('Vegas ledger — PRD 6.2 example (must reproduce exactly)', () => {
  it('−52 → −27 → +3 → −49 → +51', () => {
    let s: Session = { ledger: EMPTY_LEDGER, game: newGame(1, 'classic') };
    s = scripted(confirmNewGame(s, 'vegas', 100));
    expect(vegasBalance(s)).toBe(-52);
    s = { ...s, game: depositNext(s.game, 5) };
    expect(vegasBalance(s)).toBe(-27);
    s = { ...s, game: depositNext(s.game, 6) };
    expect(vegasBalance(s)).toBe(3);
    s = scripted(confirmNewGame(s, 'vegas', 200));
    expect(vegasBalance(s)).toBe(-49);
    s = { ...s, game: depositNext(s.game, 20) };
    expect(vegasBalance(s)).toBe(51);
  });
});

describe('restart (FR-18–20, AC 18–19)', () => {
  it('Classic restart replays the same deal and resets stats, score and undo', () => {
    let s: Session = { ledger: EMPTY_LEDGER, game: newGame(555, 'classic') };
    const original = s.game.board;
    let g = s.game;
    for (let i = 0; i < 4; i++) g = (applyAction(g, { type: 'DRAW' }) as { state: typeof g }).state;
    g = (applyAction(g, { type: 'UNDO' }) as { state: typeof g }).state;
    s = restart({ ...s, game: g }, 999);
    expect(s.game.board).toEqual(original);
    expect(s.game.seed).toBe(555);
    expect(s.game.moves).toBe(0);
    expect(s.game.undo.used).toBe(0);
    expect(classicScore(s.game)).toBe(0);
  });

  it('Vegas restart is a new deal with another $52 buy-in, keeping prior earnings', () => {
    let s: Session = scripted({ ledger: EMPTY_LEDGER, game: newGame(1, 'vegas') });
    s = { ...s, game: depositNext(s.game, 11) }; // +3
    const seed = s.game.seed;
    s = restart(s, 4242);
    expect(s.game.seed).toBe(4242);
    expect(s.game.seed).not.toBe(seed);
    expect(vegasBalance(s)).toBe(3 - 52);
  });
});

describe('ledger scope (U14, U15)', () => {
  it('carries the Vegas balance across a Classic game', () => {
    let s: Session = scripted({ ledger: EMPTY_LEDGER, game: newGame(1, 'vegas') });
    s = { ...s, game: depositNext(s.game, 2) }; // −42
    s = confirmNewGame(s, 'classic', 2);
    expect(s.ledger.settled).toBe(-42);
    s = confirmNewGame(s, 'vegas', 3);
    expect(vegasBalance(s)).toBe(-94);
  });

  it('reset sets the balance to $0 immediately; later payouts count from $0', () => {
    let s: Session = scripted({ ledger: { settled: -300 }, game: newGame(1, 'vegas') });
    s = { ...s, game: depositNext(s.game, 3) };
    s = resetVegasBalance(s);
    expect(vegasBalance(s)).toBe(0);
    s = { ...s, game: depositNext(s.game, 2) };
    expect(vegasBalance(s)).toBe(10);
  });

  it('reset during a Classic game clears the ledger to $0', () => {
    const s = resetVegasBalance({ ledger: { settled: -80 }, game: newGame(1, 'classic') });
    expect(s.ledger.settled).toBe(0);
  });
});
