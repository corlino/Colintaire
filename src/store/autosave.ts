/**
 * Keeps localStorage in step with the store (TAD §14):
 * settings and the Vegas ledger on change; the game debounced 250 ms after
 * each change, immediately on a new deal, and at once when the page is hidden.
 */
import { useGameStore, type GameStore } from './gameStore';
import { defaultStorage, KEYS, SAVE_DEBOUNCE_MS, save, type SavedGame } from './persistence';
import { haltTimer } from './timer';

export interface Autosave {
  /** Write any pending game save now. */
  flush(): void;
  stop(): void;
}

export function startAutosave(storage: Storage | null = defaultStorage()): Autosave {
  let pending: ReturnType<typeof setTimeout> | undefined;

  const writeGame = () => {
    clearTimeout(pending);
    pending = undefined;
    const s = useGameStore.getState();
    const record: SavedGame = { state: s.session.game, timer: haltTimer(s.timer, Date.now()) };
    save(storage, KEYS.game, record);
  };

  const onChange = (s: GameStore, prev: GameStore) => {
    if (s.settings !== prev.settings) save(storage, KEYS.settings, s.settings);
    if (s.session.ledger !== prev.session.ledger) save(storage, KEYS.vegas, s.session.ledger);
    if (s.dealId !== prev.dealId) writeGame();
    else if (s.session.game !== prev.session.game || s.timer !== prev.timer) {
      clearTimeout(pending);
      pending = setTimeout(writeGame, SAVE_DEBOUNCE_MS);
    }
  };

  const onHide = () => {
    if (document.visibilityState === 'hidden') writeGame();
  };

  // Make sure the opening deal is on disk, so a reload before the first move keeps it.
  writeGame();
  const unsubscribe = useGameStore.subscribe(onChange);
  const hasDoc = typeof document !== 'undefined';
  if (hasDoc) {
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', writeGame);
  }

  return {
    flush: () => {
      if (pending !== undefined) writeGame();
    },
    stop: () => {
      clearTimeout(pending);
      unsubscribe();
      if (hasDoc) {
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('pagehide', writeGame);
      }
    },
  };
}
