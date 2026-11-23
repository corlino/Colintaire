import { UNDO_LIMIT, VEGAS } from './constants';
import type { GameState } from './types';

/** Classic display score, floored at 0 (decision U8). */
export function classicScore(state: GameState): number {
  return Math.max(0, state.classic.points - state.classic.undoPenalty);
}

/** Vegas net for one game: $5 × credited − $52 (PRD 6.2). Best +$208, worst −$52. */
export function gameNet(state: GameState): number {
  return VEGAS.payout * state.vegas.credited.length - VEGAS.buyIn;
}

export function undosLeft(state: GameState): number {
  return UNDO_LIMIT - state.undo.used;
}

export function canUndo(state: GameState): boolean {
  return state.status === 'playing' && state.undo.used < UNDO_LIMIT && state.undo.history.length > 0;
}
