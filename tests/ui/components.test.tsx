// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newGame } from '../../src/engine';
import { computeMetrics } from '../../src/layout';
import { useGameStore } from '../../src/store/gameStore';
import { Board } from '../../src/ui/Board';
import { formatTime, formatVegas } from '../../src/ui/format';
import { AppearanceModal } from '../../src/ui/modals/AppearanceModal';
import { NewGameModal } from '../../src/ui/modals/NewGameModal';
import { StatsPanel } from '../../src/ui/StatsPanel';
import { cs, stateWith } from '../helpers';

const store = () => useGameStore.getState();

beforeEach(() => {
  useGameStore.setState(useGameStore.getInitialState(), true);
  store().loadGame(newGame(42, 'classic'));
});
afterEach(cleanup);

describe('formatting (U16, TAD §11.1)', () => {
  it('formats Vegas balances with a true minus sign', () => {
    expect(formatVegas(-52)).toBe('−$52');
    expect(formatVegas(51)).toBe('$51');
    expect(formatVegas(0)).toBe('$0');
  });
  it('formats time as m:ss, then h:mm:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(201)).toBe('3:21');
    expect(formatTime(3725)).toBe('1:02:05');
  });
});

describe('StatsPanel (Style Guide 6.4)', () => {
  it('shows Classic points and the Vegas balance', () => {
    render(<StatsPanel width={343} seconds={201} />);
    expect(screen.getByRole('group', { name: 'Score 0' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Time 3:21' })).toBeInTheDocument();
    act(() => store().startNewGame('vegas'));
    expect(screen.getByRole('group', { name: 'Score −$52' })).toBeInTheDocument();
  });
});

describe('New Game modal (PRD 6.3, Style Guide 7.3)', () => {
  it('uses a segmented selector and changes nothing when closed without Confirm', () => {
    act(() => store().openModal('newGame'));
    const before = store().session;
    render(<NewGameModal />);
    const vegas = screen.getByRole('radio', { name: 'Vegas' });
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(vegas);
    expect(vegas).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(store().activeModal).toBeNull();
    expect(store().session).toBe(before);
  });

  it('starts the chosen mode on Confirm', () => {
    act(() => store().openModal('newGame'));
    render(<NewGameModal />);
    fireEvent.click(screen.getByRole('radio', { name: 'Vegas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(store().session.game.mode).toBe('vegas');
    expect(store().activeModal).toBeNull();
  });

  it('resets the Vegas balance only after the confirm step (U14)', () => {
    act(() => {
      store().startNewGame('vegas');
      store().openModal('newGame');
    });
    render(<NewGameModal />);
    fireEvent.click(screen.getByRole('button', { name: /Reset Vegas balance/ }));
    expect(screen.getByText(/Reset to \$0\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(store().session.ledger.settled).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /Reset Vegas balance/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(store().session.ledger.settled).toBe(52);
    expect(screen.queryByRole('button', { name: /Reset Vegas balance/ })).not.toBeInTheDocument();
  });
});

describe('Appearance modal (PRD 7.3, Style Guide 7.2)', () => {
  it('shows exactly one selected option per collection in Phase 1', () => {
    render(<AppearanceModal />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const r of radios) expect(r).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Board controls', () => {
  it('disables Undo until there is something to undo', () => {
    render(<Board metrics={computeMetrics(343, 560)} />);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();
    act(() => {
      store().dispatch({ type: 'DRAW' });
    });
    expect(undo).not.toBeDisabled();
    fireEvent.click(undo);
    expect(store().session.game.undo.used).toBe(1);
  });

  it('opens the Appearance modal from the theme-preview button', () => {
    render(<Board metrics={computeMetrics(343, 560)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    expect(store().activeModal).toBe('appearance');
  });
});

describe('keyboard and screen-reader play (desktop, TAD §13)', () => {
  const key = (el: HTMLElement, k: string) => fireEvent.keyDown(el, { key: k });
  const pileBtn = (name: RegExp) => screen.getByRole('button', { name });

  it('selects with Enter, moves with Enter on another pile, and announces it', () => {
    act(() => store().loadGame(stateWith({ tableau: [cs('S09'), cs('H08'), [], [], [], cs('S01'), []] })));
    render(<Board metrics={computeMetrics(343, 560)} />);
    key(pileBtn(/^Pile 2, 8 of hearts/), 'Enter');
    expect(pileBtn(/^Pile 2/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('announcer')).toHaveTextContent('Selected 8 of hearts');
    key(pileBtn(/^Pile 1/), 'Enter');
    expect(store().session.game.board.tableau[0]!.map((c) => c.id)).toEqual(['S09', 'H08']);
    expect(screen.getByTestId('announcer')).toHaveTextContent('8 of hearts to pile 1');
    expect(pileBtn(/^Pile 1, 9 of spades down to 8 of hearts/)).toBeInTheDocument();
  });

  it('F sends to the foundation; Enter again reaches further down a run; Escape cancels', () => {
    act(() => store().loadGame(stateWith({ tableau: [cs('S09', 'H08'), [], [], [], [], cs('S01'), [cs('D10')[0]!]] })));
    render(<Board metrics={computeMetrics(343, 560)} />);
    key(pileBtn(/^Pile 6/), 'f');
    expect(store().session.game.board.foundations[0]!.map((c) => c.id)).toEqual(['S01']);

    const p1 = pileBtn(/^Pile 1/);
    key(p1, 'Enter');
    key(p1, 'Enter'); // now 9♠ and 8♥
    expect(screen.getByTestId('announcer')).toHaveTextContent('Selected 9 of spades and 1 more');
    key(p1, 'Escape');
    expect(p1).toHaveAttribute('aria-pressed', 'false');
    key(p1, 'Enter');
    key(p1, 'Enter');
    key(pileBtn(/^Pile 7/), 'Enter');
    expect(store().session.game.board.tableau[6]!.map((c) => c.id)).toEqual(['D10', 'S09', 'H08']);
  });

  it('the stock draws from the keyboard and says which card', () => {
    act(() => store().loadGame(stateWith({ stock: [{ id: 'C05', suit: 'C', rank: 5, faceUp: false }] })));
    render(<Board metrics={computeMetrics(343, 560)} />);
    key(screen.getByRole('button', { name: /^Stock, 1 card\./ }), 'Enter');
    expect(screen.getByTestId('announcer')).toHaveTextContent('Drew 5 of clubs');
  });
});
