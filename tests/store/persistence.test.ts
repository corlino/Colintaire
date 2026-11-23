// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAction, newGame } from '../../src/engine';
import { startAutosave, type Autosave } from '../../src/store/autosave';
import { useGameStore } from '../../src/store/gameStore';
import { KEYS, loadAll, load, save, SAVE_DEBOUNCE_MS, validateGame } from '../../src/store/persistence';
import { vegasBalance } from '../../src/store/session';
import { elapsedMs } from '../../src/store/timer';
import { orderedStockState } from '../helpers';

/** A minimal in-memory Storage. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

class ThrowingStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new Error('SecurityError');
  }
  override setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

const store = () => useGameStore.getState();
let storage: MemoryStorage;
let autosave: Autosave | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  storage = new MemoryStorage();
  useGameStore.setState(useGameStore.getInitialState(), true);
  store().loadGame(newGame(42, 'classic'));
});
afterEach(() => {
  autosave?.stop();
  autosave = undefined;
  vi.useRealTimers();
});

describe('records (TAD §14)', () => {
  it('round-trips a valid game and stores it halted', () => {
    const state = applyAction(newGame(9, 'vegas'), { type: 'DRAW' });
    if (!state.ok) throw new Error();
    save(storage, KEYS.game, { state: state.state, timer: { accumulatedMs: 1234, startedAt: 999 } });
    const loaded = load(storage, KEYS.game, validateGame)!;
    expect(loaded.state).toEqual(state.state);
    expect(loaded.timer).toEqual({ accumulatedMs: 1234, startedAt: null });
  });

  it('discards bad JSON, unknown schemas and games that break the invariants', () => {
    storage.setItem(KEYS.settings, '{nope');
    storage.setItem(KEYS.vegas, JSON.stringify({ v: 99, data: { settled: 5 } }));
    const broken = newGame(3, 'classic');
    const cheat = { ...broken, board: { ...broken.board, stock: broken.board.stock.slice(1) } }; // 51 cards
    save(storage, KEYS.game, { state: cheat, timer: { accumulatedMs: 0, startedAt: null } });
    expect(loadAll(storage)).toEqual({ settings: null, vegas: null, game: null });
    expect(storage.length).toBe(0); // bad records are removed
  });

  it('never throws when storage is unavailable', () => {
    const bad = new ThrowingStorage();
    expect(loadAll(bad)).toEqual({ settings: null, vegas: null, game: null });
    expect(save(bad, KEYS.vegas, { settled: 1 })).toBe(false);
    expect(loadAll(null)).toEqual({ settings: null, vegas: null, game: null });
  });
});

describe('autosave and restore (U12, U13)', () => {
  it('saves the game after a 250 ms debounce and restores it with its time', () => {
    autosave = startAutosave(storage);
    vi.setSystemTime(10_000);
    store().dispatch({ type: 'DRAW' });
    const game = store().session.game;
    expect(loadAll(storage).game?.state).not.toEqual(game);
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(loadAll(storage).game?.state).toEqual(game);
    autosave.stop();

    // Simulate a cold launch an hour later.
    useGameStore.setState(useGameStore.getInitialState(), true);
    vi.setSystemTime(3_600_000);
    store().restore(loadAll(storage));
    expect(store().session.game).toEqual(game);
    expect(store().animateDeal).toBe(false);
    vi.setSystemTime(3_602_000);
    expect(elapsedMs(store().timer, Date.now())).toBe(12_250); // saved 250 ms after the move; time while closed never counts
  });

  it('writes immediately on a new deal and when the page is hidden', () => {
    autosave = startAutosave(storage);
    store().startNewGame('vegas');
    expect(loadAll(storage).game?.state.mode).toBe('vegas');
    store().dispatch({ type: 'DRAW' });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(loadAll(storage).game?.state).toEqual(store().session.game);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('keeps the Vegas balance and settings across a reload (PRD 6.2)', () => {
    autosave = startAutosave(storage);
    store().startNewGame('vegas'); // −52 live
    store().startNewGame('vegas'); // −52 settled, −52 live
    store().setTheme('nebula-dusk');
    expect(vegasBalance(store().session)).toBe(-104);
    autosave.stop();

    useGameStore.setState(useGameStore.getInitialState(), true);
    store().restore(loadAll(storage));
    expect(vegasBalance(store().session)).toBe(-104);
    expect(store().settings.lastMode).toBe('vegas');
  });

  it('reopens a won game on the win screen', () => {
    let g = orderedStockState('classic');
    for (let i = 0; i < 52; i++) {
      const drawn = applyAction(g, { type: 'DRAW' });
      if (!drawn.ok) throw new Error();
      const card = drawn.state.board.waste.at(-1)!;
      const to = { kind: 'foundation', index: ['S', 'H', 'C', 'D'].indexOf(card.suit) } as const;
      const moved = applyAction(drawn.state, { type: 'MOVE', from: { kind: 'waste' }, cardIndex: drawn.state.board.waste.length - 1, to });
      if (!moved.ok) throw new Error();
      g = moved.state;
    }
    expect(g.status).toBe('won');
    save(storage, KEYS.game, { state: g, timer: { accumulatedMs: 5000, startedAt: null } });
    store().restore(loadAll(storage));
    expect(store().activeModal).toBe('win');
    expect(store().timer.startedAt).toBeNull();
  });

  it('falls back to the default deal when nothing valid is saved', () => {
    const before = store().session.game;
    store().restore(loadAll(storage));
    expect(store().session.game).toBe(before);
  });
});
