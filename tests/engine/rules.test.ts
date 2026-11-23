import { describe, expect, it } from 'vitest';
import {
  autoFoundationTarget,
  canPickUp,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  isLegalMove,
  isValidRun,
} from '../../src/engine';
import { c, cs, F, S, stateWith, T, W } from '../helpers';

describe('tableau placement (PRD 5.3)', () => {
  it('accepts only a King on an empty pile', () => {
    expect(canPlaceOnTableau(c('S13'), [])).toBe(true);
    expect(canPlaceOnTableau(c('H12'), [])).toBe(false);
  });
  it('requires opposite colour, one rank lower', () => {
    expect(canPlaceOnTableau(c('H06'), cs('S07'))).toBe(true);
    expect(canPlaceOnTableau(c('C06'), cs('S07'))).toBe(false);
    expect(canPlaceOnTableau(c('H05'), cs('S07'))).toBe(false);
    expect(canPlaceOnTableau(c('D08'), cs('S07'))).toBe(false);
  });
  it('never places on a face-down card', () => {
    expect(canPlaceOnTableau(c('H06'), cs('s07'))).toBe(false);
  });
});

describe('foundation placement (PRD 5.4, U7 fixed slots ♠ ♥ ♣ ♦)', () => {
  it('starts with the Ace in its own suit slot', () => {
    expect(canPlaceOnFoundation(c('S01'), 0, [])).toBe(true);
    expect(canPlaceOnFoundation(c('H01'), 0, [])).toBe(false);
    expect(canPlaceOnFoundation(c('H01'), 1, [])).toBe(true);
    expect(canPlaceOnFoundation(c('D01'), 3, [])).toBe(true);
  });
  it('builds up by one in the same suit', () => {
    expect(canPlaceOnFoundation(c('S02'), 0, cs('S01'))).toBe(true);
    expect(canPlaceOnFoundation(c('S03'), 0, cs('S01'))).toBe(false);
  });
});

describe('runs and pick-up', () => {
  it('validates alternating descending face-up runs', () => {
    expect(isValidRun(cs('S09', 'H08', 'C07'))).toBe(true);
    expect(isValidRun(cs('S09', 'C08'))).toBe(false);
    expect(isValidRun(cs('S09', 'H07'))).toBe(false);
    expect(isValidRun(cs('s09', 'H08'))).toBe(false);
  });
  it('picks up any valid run from a tableau, only the top from waste/foundation, never from stock', () => {
    const s = stateWith({
      tableau: [cs('d03', 'S09', 'H08', 'C07'), [], [], [], [], [], []],
      waste: cs('H02', 'H03'),
      foundations: [cs('S01', 'S02'), [], [], []],
      stock: cs('c05'),
    });
    expect(canPickUp(s.board, T(0), 1)).toBe(true);
    expect(canPickUp(s.board, T(0), 3)).toBe(true);
    expect(canPickUp(s.board, T(0), 0)).toBe(false); // face down
    expect(canPickUp(s.board, W, 1)).toBe(true);
    expect(canPickUp(s.board, W, 0)).toBe(false);
    expect(canPickUp(s.board, F(0), 1)).toBe(true);
    expect(canPickUp(s.board, S, 0)).toBe(false);
  });
});

describe('isLegalMove', () => {
  const s = stateWith({
    tableau: [cs('S09', 'H08'), cs('C09'), [], cs('h05', 'D13'), [], cs('D10'), cs('s04', 'S01')],
    waste: cs('S07'),
    foundations: [[], cs('H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07'), [], []],
  });

  it('moves a run between the normal and reversed rows identically (PRD 4.3, AC 4–5)', () => {
    expect(isLegalMove(s.board, T(0), 0, T(5))).toBe(true); // pile 1 → pile 6
    expect(isLegalMove(s.board, T(3), 1, T(2))).toBe(true); // King to empty
  });
  it('moves a single card only to a foundation', () => {
    expect(isLegalMove(s.board, T(0), 1, F(1))).toBe(true); // H08 on H07
    expect(isLegalMove(s.board, T(0), 0, F(1))).toBe(false); // two cards
    expect(isLegalMove(s.board, T(6), 1, F(0))).toBe(true); // Ace of spades
  });
  it('allows foundation → tableau (U4) but never foundation → foundation', () => {
    expect(isLegalMove(s.board, F(1), 6, T(0))).toBe(false); // H07 on H08 — same colour
    const s2 = stateWith({ tableau: [cs('S08'), [], [], [], [], [], []], foundations: [[], cs('H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07'), [], []] });
    expect(isLegalMove(s2.board, F(1), 6, T(0))).toBe(true);
    expect(isLegalMove(s2.board, F(1), 6, F(0))).toBe(false);
  });
  it('never moves to stock or waste, or onto the same pile', () => {
    expect(isLegalMove(s.board, T(0), 1, W)).toBe(false);
    expect(isLegalMove(s.board, T(0), 1, S)).toBe(false);
    expect(isLegalMove(s.board, T(0), 0, T(0))).toBe(false);
  });
  it('rejects out-of-range pile refs and indices', () => {
    expect(isLegalMove(s.board, T(9), 0, T(0))).toBe(false);
    expect(isLegalMove(s.board, T(0), 5, T(1))).toBe(false);
    expect(isLegalMove(s.board, T(0), 0, F(4))).toBe(false);
  });
  it('finds the double-tap foundation target (U9)', () => {
    expect(autoFoundationTarget(s.board, T(6), 1)).toEqual(F(0));
    expect(autoFoundationTarget(s.board, W, 0)).toBeNull();
  });
});
