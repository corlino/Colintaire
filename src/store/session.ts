/**
 * Cross-game session logic (TAD §8.4): new game, restart and the Vegas ledger.
 * Pure functions — the Zustand store (M4) wraps these with timer and modal state.
 *
 * The ledger keeps one running number, `settled`: the sum of every finished
 * Vegas game's net since the last reset. The live balance adds the current
 * Vegas game's net on top. No per-game history is stored (decision U14).
 */
import { gameNet, newGame, type GameMode, type GameState } from '../engine';

export interface VegasLedger {
  readonly settled: number;
}

export interface Session {
  readonly game: GameState;
  readonly ledger: VegasLedger;
}

export const EMPTY_LEDGER: VegasLedger = { settled: 0 };

/** The Vegas balance shown in the Score tile during a Vegas game. */
export function vegasBalance(session: Session): number {
  const live = session.game.mode === 'vegas' ? gameNet(session.game) : 0;
  return session.ledger.settled + live;
}

function settle(session: Session): VegasLedger {
  if (session.game.mode !== 'vegas') return session.ledger;
  return { settled: session.ledger.settled + gameNet(session.game) };
}

/** Confirm in the New Game modal (PRD 6.3). Settles a running Vegas game, then deals fresh. */
export function confirmNewGame(session: Session, mode: GameMode, seed: number): Session {
  return { ledger: settle(session), game: newGame(seed, mode) };
}

/**
 * Restart control. Classic replays the same deal with stats reset (FR-19).
 * Vegas is a new game with a fresh deal and another $52 buy-in (FR-20).
 */
export function restart(session: Session, freshSeed: number): Session {
  if (session.game.mode !== 'vegas') {
    // Classic (and Trini, whose button reshuffles instead) replay the same deal.
    return { ledger: session.ledger, game: newGame(session.game.seed, session.game.mode) };
  }
  return { ledger: settle(session), game: newGame(freshSeed, 'vegas') };
}

/** Reset the Vegas balance to $0 now (decision U14). The game on the board carries on. */
export function resetVegasBalance(session: Session): Session {
  const live = session.game.mode === 'vegas' ? gameNet(session.game) : 0;
  return { ...session, ledger: { settled: 0 - live } }; // 0 - x avoids -0
}
