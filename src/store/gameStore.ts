/**
 * The one Zustand store (TAD §4): wraps the pure engine and session logic.
 * Timer, modal state and persistence are added in M4–M5.
 */
import { create } from 'zustand';
import { applyAction, newGame, randomSeed, type Action, type GameMode, type GameState, type Result } from '../engine';
import { DEFAULTS } from '../assets/registry';
import { confirmNewGame, EMPTY_LEDGER, resetVegasBalance, restart, type Session } from './session';

export interface Settings {
  readonly themeId: string;
  readonly cardBackId: string;
  readonly cardFaceId: string;
  readonly lastMode: GameMode;
}

export interface GameStore {
  readonly session: Session;
  readonly settings: Settings;
  dispatch(action: Action): Result;
  startNewGame(mode: GameMode): void;
  restartGame(): void;
  resetBalance(): void;
  setTheme(id: string): void;
  setCardBack(id: string): void;
  /** Development/test only: load a specific game. */
  loadGame(game: GameState): void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  session: { ledger: EMPTY_LEDGER, game: newGame(randomSeed(), 'classic') }, // U3: deal Classic on first launch
  settings: { themeId: DEFAULTS.theme, cardBackId: DEFAULTS.back, cardFaceId: DEFAULTS.face, lastMode: 'classic' },

  dispatch(action) {
    const result = applyAction(get().session.game, action);
    if (result.ok) set((s) => ({ session: { ...s.session, game: result.state } }));
    return result;
  },
  startNewGame(mode) {
    set((s) => ({ session: confirmNewGame(s.session, mode, randomSeed()), settings: { ...s.settings, lastMode: mode } }));
  },
  restartGame() {
    set((s) => ({ session: restart(s.session, randomSeed()) }));
  },
  resetBalance() {
    set((s) => ({ session: resetVegasBalance(s.session) }));
  },
  setTheme(id) {
    set((s) => ({ settings: { ...s.settings, themeId: id } }));
  },
  setCardBack(id) {
    set((s) => ({ settings: { ...s.settings, cardBackId: id } }));
  },
  loadGame(game) {
    set((s) => ({ session: { ...s.session, game } }));
  },
}));
