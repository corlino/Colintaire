/**
 * Development/test-only hook (TAD §16.1): window.__colintaire lets E2E tests and
 * manual checks start from a known deal or load an arbitrary game state.
 */
import { newGame, type GameMode, type GameState } from '../engine';
import { useGameStore } from './gameStore';

declare global {
  interface Window {
    __colintaire?: {
      newGame(opts: { seed: number; mode?: GameMode }): void;
      loadGame(game: GameState): void;
      getState(): GameState;
    };
  }
}

export function installDevHook() {
  window.__colintaire = {
    newGame: ({ seed, mode = 'classic' }) => useGameStore.getState().loadGame(newGame(seed, mode)),
    loadGame: (game) => useGameStore.getState().loadGame(game),
    getState: () => useGameStore.getState().session.game,
  };
}
