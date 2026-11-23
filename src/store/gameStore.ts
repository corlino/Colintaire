/**
 * The one Zustand store (TAD §4): wraps the pure engine and session logic with
 * session concerns — the timer, modal state and pause reasons.
 * Saving lives in autosave.ts; `restore` applies what persistence.ts loaded.
 */
import { create } from 'zustand';
import { applyAction, newGame, randomSeed, type Action, type GameMode, type GameState, type Result } from '../engine';
import { DEFAULTS } from '../assets/registry';
import { confirmNewGame, EMPTY_LEDGER, resetVegasBalance, restart, type Session } from './session';
import type { Saved } from './persistence';
import { syncTimer, TIMER_ZERO, type PauseReason, type TimerState } from './timer';

export interface Settings {
  readonly themeId: string;
  readonly cardBackId: string;
  readonly cardFaceId: string;
  readonly lastMode: GameMode;
}

export type ModalName = 'appearance' | 'newGame' | 'win';

/** Delay before the win modal appears after the last foundation move (TAD §11.2). */
export const WIN_MODAL_DELAY = 400;

export interface GameStore {
  readonly session: Session;
  readonly settings: Settings;
  readonly timer: TimerState;
  readonly pauseReasons: readonly PauseReason[];
  readonly activeModal: ModalName | null;
  /** Increments on every new deal (new game or restart) so the board can play the deal animation. */
  readonly dealId: number;
  /** False after restoring a saved game, so reopening the app does not replay the deal. */
  readonly animateDeal: boolean;

  dispatch(action: Action): Result;
  startNewGame(mode: GameMode): void;
  restartGame(): void;
  resetBalance(): void;
  setTheme(id: string): void;
  setCardBack(id: string): void;
  openModal(name: ModalName): void;
  closeModal(): void;
  setPaused(reason: PauseReason, paused: boolean): void;
  /** Development/test only: load a specific game. */
  loadGame(game: GameState): void;
  /** Apply saved records at launch (TAD §14). Missing records keep their defaults. */
  restore(saved: Saved): void;
}

const now = () => Date.now();

type Core = Pick<GameStore, 'session' | 'timer' | 'pauseReasons'>;

/** Recompute the timer from the current game status and pause reasons. */
function withSyncedTimer<T extends Core>(s: T): T {
  const shouldRun = s.session.game.status === 'playing' && s.pauseReasons.length === 0;
  return { ...s, timer: syncTimer(s.timer, shouldRun, now()) };
}

let winTimeout: ReturnType<typeof setTimeout> | undefined;

export const useGameStore = create<GameStore>()((set, get) => {
  /** Swap in a freshly dealt session: timer back to 0, any modal closed. */
  const deal = (session: Session, extra: Partial<GameStore> = {}) => {
    clearTimeout(winTimeout);
    set((s) => {
      const pauseReasons = s.pauseReasons.filter((r) => r !== 'modal');
      return withSyncedTimer({ ...s, ...extra, session, timer: TIMER_ZERO, pauseReasons, activeModal: null, dealId: s.dealId + 1, animateDeal: true });
    });
  };

  return {
    session: { ledger: EMPTY_LEDGER, game: newGame(randomSeed(), 'classic') }, // U3: deal Classic on first launch
    settings: { themeId: DEFAULTS.theme, cardBackId: DEFAULTS.back, cardFaceId: DEFAULTS.face, lastMode: 'classic' },
    timer: { accumulatedMs: 0, startedAt: now() },
    pauseReasons: [],
    activeModal: null,
    dealId: 0,
    animateDeal: true,

    dispatch(action) {
      const result = applyAction(get().session.game, action);
      if (!result.ok) return result;
      set((s) => withSyncedTimer({ ...s, session: { ...s.session, game: result.state } }));
      if (result.state.status === 'won') {
        clearTimeout(winTimeout);
        winTimeout = setTimeout(() => get().openModal('win'), WIN_MODAL_DELAY);
      }
      return result;
    },
    startNewGame(mode) {
      const s = get();
      deal(confirmNewGame(s.session, mode, randomSeed()), { settings: { ...s.settings, lastMode: mode } });
    },
    restartGame() {
      deal(restart(get().session, randomSeed()));
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
    openModal(name) {
      set((s) => {
        const pauseReasons = s.pauseReasons.includes('modal') ? s.pauseReasons : [...s.pauseReasons, 'modal' as const];
        return withSyncedTimer({ ...s, activeModal: name, pauseReasons });
      });
    },
    closeModal() {
      set((s) => withSyncedTimer({ ...s, activeModal: null, pauseReasons: s.pauseReasons.filter((r) => r !== 'modal') }));
    },
    setPaused(reason, paused) {
      set((s) => {
        const has = s.pauseReasons.includes(reason);
        if (has === paused) return s;
        const pauseReasons = paused ? [...s.pauseReasons, reason] : s.pauseReasons.filter((r) => r !== reason);
        return withSyncedTimer({ ...s, pauseReasons });
      });
    },
    loadGame(game) {
      deal({ ...get().session, game });
    },
    restore(saved) {
      clearTimeout(winTimeout);
      set((s) => {
        const settings = saved.settings ?? s.settings;
        const ledger = saved.vegas ?? s.session.ledger;
        if (!saved.game) return { ...s, settings, session: { ...s.session, ledger } };
        // A game saved after its win reopens on the win screen.
        const won = saved.game.state.status === 'won';
        const pauseReasons = won ? [...s.pauseReasons.filter((r) => r !== 'modal'), 'modal' as const] : s.pauseReasons;
        return withSyncedTimer({
          ...s,
          settings,
          session: { ledger, game: saved.game.state },
          timer: saved.game.timer,
          pauseReasons,
          activeModal: won ? ('win' as const) : null,
          animateDeal: false,
        });
      });
    },
  };
});
