import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '../../src/engine';
import { useGameStore, WIN_MODAL_DELAY } from '../../src/store/gameStore';
import { vegasBalance } from '../../src/store/session';
import { elapsedMs } from '../../src/store/timer';
import { orderedStockState } from '../helpers';

const store = () => useGameStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  useGameStore.setState(useGameStore.getInitialState(), true);
  store().loadGame(newGame(42, 'classic'));
});
afterEach(() => vi.useRealTimers());

const elapsed = () => elapsedMs(store().timer, Date.now());

describe('timer and modals (Style Guide 9.1, PRD 8.3)', () => {
  it('runs from the deal and pauses while a modal is open', () => {
    vi.setSystemTime(5000);
    expect(elapsed()).toBe(5000);
    store().openModal('appearance');
    vi.setSystemTime(20_000);
    expect(elapsed()).toBe(5000);
    store().closeModal();
    vi.setSystemTime(21_000);
    expect(elapsed()).toBe(6000);
  });

  it('pauses while the page is hidden, independently of modals', () => {
    store().setPaused('hidden', true);
    store().openModal('newGame');
    store().closeModal();
    vi.setSystemTime(9000);
    expect(elapsed()).toBe(0);
    store().setPaused('hidden', false);
    vi.setSystemTime(10_000);
    expect(elapsed()).toBe(1000);
  });

  it('opening and closing a modal never changes the game', () => {
    const before = store().session;
    store().openModal('newGame');
    store().closeModal();
    store().openModal('appearance');
    store().setTheme('nebula-dusk');
    store().closeModal();
    expect(store().session).toBe(before);
  });
});

describe('inspect view', () => {
  it('opens on the chosen card, pauses the timer like any modal and leaves the game alone', () => {
    const before = store().session;
    vi.setSystemTime(4000);
    store().inspect('H08');
    expect(store().activeModal).toBe('inspect');
    expect(store().inspectCardId).toBe('H08');
    vi.setSystemTime(9000);
    expect(elapsed()).toBe(4000);
    store().closeModal();
    expect(store().activeModal).toBeNull();
    expect(store().session).toBe(before);
  });
});

describe('new game, restart and win', () => {
  it('confirming a new game deals fresh, resets the timer and closes the modal', () => {
    vi.setSystemTime(30_000);
    store().openModal('newGame');
    const seed = store().session.game.seed;
    store().startNewGame('vegas');
    expect(store().activeModal).toBeNull();
    expect(store().session.game.mode).toBe('vegas');
    expect(store().session.game.seed).not.toBe(seed);
    expect(store().settings.lastMode).toBe('vegas');
    expect(vegasBalance(store().session)).toBe(-52);
    vi.setSystemTime(31_000);
    expect(elapsed()).toBe(1000);
  });

  it('Classic restart replays the deal; Vegas restart charges again', () => {
    const board = store().session.game.board;
    store().dispatch({ type: 'DRAW' });
    store().restartGame();
    expect(store().session.game.board).toEqual(board);
    expect(store().session.game.moves).toBe(0);

    store().startNewGame('vegas');
    store().restartGame();
    expect(vegasBalance(store().session)).toBe(-104);
  });

  it('stops the timer on a win and opens the win modal after 400 ms', () => {
    let g = orderedStockState('classic');
    store().loadGame(g);
    for (let i = 0; i < 52; i++) {
      store().dispatch({ type: 'DRAW' });
      g = store().session.game;
      const card = g.board.waste[g.board.waste.length - 1]!;
      store().dispatch({ type: 'MOVE', from: { kind: 'waste' }, cardIndex: g.board.waste.length - 1, to: { kind: 'foundation', index: ['S', 'H', 'C', 'D'].indexOf(card.suit) } });
    }
    expect(store().session.game.status).toBe('won');
    expect(store().timer.startedAt).toBeNull();
    expect(store().activeModal).toBeNull();
    vi.advanceTimersByTime(WIN_MODAL_DELAY);
    expect(store().activeModal).toBe('win');
  });

  it('invalid actions change nothing', () => {
    const before = store().session;
    const r = store().dispatch({ type: 'UNDO' });
    expect(r.ok).toBe(false);
    expect(store().session).toBe(before);
  });
});
