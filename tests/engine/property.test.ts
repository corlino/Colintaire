/**
 * Property tests (TAD §16.1): random legal action sequences from random seeds.
 * After every step the invariants hold, undo restores the snapshot exactly,
 * and the Vegas net always equals 5 × credited − 52.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  assertInvariants,
  classicScore,
  gameNet,
  newGame,
  type Action,
  type GameMode,
} from '../../src/engine';
import { legalActions } from '../helpers';

describe('engine properties', () => {
  it('stays valid through long random games', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.constantFrom<GameMode>('classic', 'vegas', 'trini'),
        fc.array(fc.nat(), { minLength: 50, maxLength: 500 }),
        (seed, mode, choices) => {
          let s = newGame(seed, mode);
          assertInvariants(s);
          for (const choice of choices) {
            const actions = legalActions(s);
            if (actions.length === 0) break;
            const action = actions[choice % actions.length]!;
            const before = s;
            const r = applyAction(s, action);
            expect(r.ok).toBe(true);
            if (!r.ok) return;
            s = r.state;
            assertInvariants(s);

            if (action.type === 'UNDO') {
              const snap = before.undo.history[before.undo.history.length - 1]!;
              expect(s.board).toEqual(snap.board);
              expect(s.moves).toBe(snap.moves);
              expect(s.undo.used).toBe(before.undo.used + 1);
              expect(s.vegas.everPaid).toEqual(before.vegas.everPaid);
            } else {
              expect(s.moves).toBe(before.moves + 1);
            }
            expect(gameNet(s)).toBe(5 * s.vegas.credited.length - 52);
            expect(s.vegas.everPaid.length).toBeGreaterThanOrEqual(before.vegas.everPaid.length);
            expect(classicScore(s)).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it('rejects every illegal move without side effects', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.nat(6), fc.nat(20), fc.nat(10), (seed, from, idx, to) => {
        const s = newGame(seed, 'classic');
        const action: Action = {
          type: 'MOVE',
          from: { kind: 'tableau', index: from },
          cardIndex: idx,
          to: to < 7 ? { kind: 'tableau', index: to } : { kind: 'foundation', index: to - 7 },
        };
        const legal = legalActions(s).some((a) => JSON.stringify(a) === JSON.stringify(action));
        const r = applyAction(s, action);
        expect(r.ok).toBe(legal);
      }),
      { numRuns: 300 },
    );
  });
});
