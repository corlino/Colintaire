// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newGame } from '../../src/engine';
import { computeMetrics } from '../../src/layout';
import { useGameStore } from '../../src/store/gameStore';
import { CARD_BACKS, CARD_FACES, THEMES } from '../../src/assets/registry';
import { App } from '../../src/ui/App';
import { Board } from '../../src/ui/Board';
import { formatTime, formatVegas } from '../../src/ui/format';
import { AppearanceModal } from '../../src/ui/modals/AppearanceModal';
import { InspectView } from '../../src/ui/modals/InspectView';
import { NewGameModal } from '../../src/ui/modals/NewGameModal';
import { ReshuffleModal } from '../../src/ui/modals/ReshuffleModal';
import { randomQuote, RESHUFFLE_QUOTES } from '../../src/ui/quotes';
import { StatsPanel, statValueClass } from '../../src/ui/StatsPanel';
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

describe('stat value sizing', () => {
  it('steps the font down for longer values instead of truncating', () => {
    expect(statValueClass('−$52')).toBe('text-stat-value');
    expect(statValueClass('10:23')).toBe('text-stat-value');
    expect(statValueClass('−$104')).toBe('text-stat-value');
    expect(statValueClass('−$1040')).toBe('text-stat-value-md');
    expect(statValueClass('1:02:05')).toBe('text-stat-value-sm');
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
  it('lists every theme, card back and face set, with exactly one selected in each', () => {
    render(<AppearanceModal />);
    const groups: [string, readonly { name: string }[]][] = [
      ['Interface Theme', THEMES],
      ['Card Style', CARD_BACKS],
      ['Card Faces', CARD_FACES],
    ];
    for (const [name, list] of groups) {
      const radios = within(screen.getByRole('radiogroup', { name })).getAllByRole('radio');
      expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(list.map((a) => a.name));
      expect(radios.filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    }
  });

  it('switches the card faces immediately and leaves the game alone (AC 27)', () => {
    const game = store().session.game;
    render(<AppearanceModal />);
    const last = CARD_FACES.at(-1)!;
    fireEvent.click(screen.getByRole('radio', { name: last.name }));
    expect(store().settings.cardFaceId).toBe(last.id);
    expect(screen.getByRole('radio', { name: last.name })).toHaveAttribute('aria-checked', 'true');
    expect(store().session.game).toBe(game);
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

describe('Reshuffle pop-up', () => {
  it('the reshuffle button asks first instead of dealing', () => {
    render(<Board metrics={computeMetrics(343, 560)} />);
    const deal = store().dealId;
    fireEvent.click(screen.getByRole('button', { name: 'Reshuffle' }));
    expect(store().activeModal).toBe('reshuffle');
    expect(store().dealId).toBe(deal);
  });

  it('shows a quote and its author; closing changes nothing, Confirm restarts', () => {
    act(() => store().openModal('reshuffle'));
    const deal = store().dealId;
    render(<ReshuffleModal />);
    const dialog = screen.getByRole('dialog', { name: 'Reshuffle' });
    expect(RESHUFFLE_QUOTES.some((q) => within(dialog).queryByText(q.author))).toBe(true);
    expect(within(dialog).queryByText('Costs $52 to deal')).toBeNull(); // Classic: no note
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(store().activeModal).toBeNull();
    expect(store().dealId).toBe(deal);
    cleanup();
    act(() => store().openModal('reshuffle'));
    render(<ReshuffleModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(store().dealId).toBe(deal + 1);
    expect(store().activeModal).toBeNull();
  });

  it('notes the Vegas cost', () => {
    act(() => store().startNewGame('vegas'));
    render(<ReshuffleModal />);
    expect(screen.getByText('Costs $52 to deal')).toBeInTheDocument();
  });

  it('picks any of the four quotes', () => {
    expect(RESHUFFLE_QUOTES).toHaveLength(4);
    expect(randomQuote(() => 0)).toBe(RESHUFFLE_QUOTES[0]);
    expect(randomQuote(() => 0.99)).toBe(RESHUFFLE_QUOTES[3]);
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

describe('inspect a selected card', () => {
  const key = (el: HTMLElement, k: string) => fireEvent.keyDown(el, { key: k });

  it('swaps Appearance for an eye while a card is selected, and opens the inspect view on it', () => {
    act(() => store().loadGame(stateWith({ tableau: [cs('S09'), cs('H08'), [], [], [], [], []] })));
    render(<Board metrics={computeMetrics(343, 560)} />);
    expect(screen.getByRole('button', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inspect card' })).toBeNull();

    const pile2 = screen.getByRole('button', { name: /^Pile 2/ });
    key(pile2, 'Enter');
    expect(screen.queryByRole('button', { name: 'Appearance' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect card' }));
    expect(store().activeModal).toBe('inspect');
    expect(store().inspectCardId).toBe('H08');
    expect(pile2).toHaveAttribute('aria-pressed', 'true'); // still selected afterwards

    key(pile2, 'Escape');
    expect(screen.getByRole('button', { name: 'Appearance' })).toBeInTheDocument();
  });

  it('shows the card large, flips to the back on tap, and closes with X or Escape', () => {
    act(() => {
      store().loadGame(stateWith({ tableau: [cs('S09'), cs('H08'), [], [], [], [], []] }));
      store().inspect('H08');
    });
    render(<InspectView />);
    expect(screen.getByRole('dialog', { name: '8 of hearts' })).toBeInTheDocument();
    const flip = screen.getByRole('button', { name: 'Flip card' });
    expect(flip).toHaveAttribute('data-side', 'front');
    fireEvent.click(flip);
    expect(flip).toHaveAttribute('data-side', 'back');
    fireEvent.click(flip);
    expect(flip).toHaveAttribute('data-side', 'front');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(store().activeModal).toBeNull();

    act(() => store().inspect('H08'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(store().activeModal).toBeNull();
  });

  it('closes when the dark area around the card is tapped', () => {
    act(() => {
      store().loadGame(stateWith({ tableau: [cs('S09'), cs('H08'), [], [], [], [], []] }));
      store().inspect('H08');
    });
    render(<InspectView />);
    fireEvent.click(screen.getByTestId('inspect-backdrop'));
    expect(store().activeModal).toBeNull();
  });
});

describe('themes and card backs (AC 24–26)', () => {
  it('a theme only sets the background variables; fonts and controls are untouched', () => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const root = document.documentElement.style;
    for (const p of [...root]) root.removeProperty(p);
    render(<App />);
    const props = [...root].sort();
    expect(props).toEqual(['--app-bg-image', '--app-bg-image-wide', '--app-bg-scrim']);
    expect(root.getPropertyValue('--app-bg-image')).toBe(THEMES[0]!.background);
  });

  it('face-down cards use the selected card back', () => {
    const { container } = render(<Board metrics={computeMetrics(343, 560)} />);
    const backs = [...container.querySelectorAll('[data-card] img')].map((img) => img.getAttribute('src'));
    expect(backs.length).toBeGreaterThan(0);
    expect(new Set(backs)).toEqual(new Set([CARD_BACKS[0]!.src]));
  });
});
