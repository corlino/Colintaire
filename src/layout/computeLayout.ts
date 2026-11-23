/**
 * computeLayout(board, metrics) → pixel positions for every card plus drop
 * targets for every pile (TAD §9). React only renders what this returns.
 * Coordinates are relative to the board's top-left corner.
 */
import type { Board, CardId, Pile, PileRef } from '../engine/types';
import { fitStack, splitColumn, type StackShape } from './fan';
import { STACK_GAP, type Metrics } from './metrics';
import { APPEARANCE_COL, BOTTOM_ROW, SHARED_COLUMNS, SLOT_MAP, type Grow } from './slots';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface CardPlacement {
  readonly id: CardId;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly faceUp: boolean;
  readonly pile: PileRef;
  readonly index: number;
  /** Part of a folded bundle (3 px strip, index hidden). */
  readonly folded: boolean;
  /** Visible height of this card: its strip if covered, cardH if on top. */
  readonly strip: number;
  /** Which edge of the card is visible when covered. */
  readonly grow: Grow;
}

export interface PileTarget {
  readonly ref: PileRef;
  readonly rect: Rect;
}

export interface BundlePlacement {
  readonly pile: number;
  readonly rect: Rect;
  readonly count: number;
}

export interface LayoutResult {
  readonly metrics: Metrics;
  readonly cards: readonly CardPlacement[];
  readonly targets: readonly PileTarget[];
  readonly bundles: readonly BundlePlacement[];
  readonly slots: {
    readonly foundations: readonly Rect[];
    readonly tableau: readonly { readonly rect: Rect; readonly grow: Grow }[];
    readonly waste: Rect;
    readonly stock: Rect;
    readonly undo: Rect;
    readonly restart: Rect;
    readonly appearance: Rect;
  };
  /** Height each tableau pile was given, for tests and the peek panel. */
  readonly allocations: readonly number[];
}

const shapeOf = (pile: Pile): StackShape => {
  const down = pile.filter((c) => !c.faceUp).length;
  return { down, up: pile.length - down };
};

const T = (index: number): PileRef => ({ kind: 'tableau', index });

export function computeLayout(board: Board, m: Metrics): LayoutResult {
  const { cardW, cardH, colX, tableauTop, floor } = m;
  const cards: CardPlacement[] = [];
  const targets: PileTarget[] = [];
  const bundles: BundlePlacement[] = [];
  const col = (c: number) => colX[c] ?? 0;
  const cardRect = (c: number, y: number): Rect => ({ x: col(c), y, w: cardW, h: cardH });

  // ---- Foundation row: four foundations, then the Appearance button.
  const foundations = board.foundations.map((_, i) => cardRect(i, 0));
  board.foundations.forEach((pile, i) => {
    pile.forEach((card, idx) => {
      cards.push({
        id: card.id, x: col(i), y: 0, z: idx, faceUp: card.faceUp,
        pile: { kind: 'foundation', index: i }, index: idx, folded: false,
        strip: idx === pile.length - 1 ? cardH : 0, grow: 'down',
      });
    });
    targets.push({ ref: { kind: 'foundation', index: i }, rect: foundations[i] as Rect });
  });
  const appearance: Rect = {
    x: col(APPEARANCE_COL) + (cardW - m.button) / 2,
    y: (cardH - m.button) / 2,
    w: m.button,
    h: m.button,
  };

  // ---- Bottom row: controls, waste, stock.
  const waste = cardRect(BOTTOM_ROW.wasteCol, floor - cardH);
  const stock = cardRect(BOTTOM_ROW.stockCol, floor - cardH);
  const bx = col(BOTTOM_ROW.controlsCol) + (cardW - m.button) / 2;
  const undo: Rect = { x: bx, y: m.controlsTop, w: m.button, h: m.button };
  const restart: Rect = { x: bx, y: floor - m.button, w: m.button, h: m.button };

  for (const [name, pile, rect] of [
    ['waste', board.waste, waste],
    ['stock', board.stock, stock],
  ] as const) {
    pile.forEach((card, idx) => {
      cards.push({
        id: card.id, x: rect.x, y: rect.y, z: idx, faceUp: card.faceUp,
        pile: { kind: name }, index: idx, folded: false,
        strip: idx === pile.length - 1 ? cardH : 0, grow: 'down',
      });
    });
  }
  targets.push({ ref: { kind: 'waste' }, rect: waste });
  targets.push({ ref: { kind: 'stock' }, rect: stock });

  // ---- Tableau: give each pile its vertical allowance.
  const allocations: number[] = new Array(7).fill(0);
  const sharedAvail = floor - tableauTop - STACK_GAP;
  for (const [topP, botP] of SHARED_COLUMNS) {
    const [a, b] = splitColumn(shapeOf(board.tableau[topP] as Pile), shapeOf(board.tableau[botP] as Pile), sharedAvail, m);
    allocations[topP] = a;
    allocations[botP] = b;
  }
  allocations[2] = m.controlsTop - STACK_GAP - tableauTop;
  allocations[3] = floor - cardH - STACK_GAP - tableauTop;
  allocations[4] = floor - cardH - STACK_GAP - tableauTop;

  const tableauSlots = SLOT_MAP.map((slot) => {
    const y = slot.grow === 'down' ? tableauTop : floor - cardH;
    return { rect: cardRect(slot.col, y), grow: slot.grow };
  });

  board.tableau.forEach((pile, p) => {
    const slot = SLOT_MAP[p];
    if (!slot) return;
    const alloc = allocations[p] ?? 0;
    const fan = fitStack(shapeOf(pile), alloc, m);
    const x = col(slot.col);
    let acc = 0;
    const ys: number[] = [];
    pile.forEach((card, idx) => {
      const y = slot.grow === 'down' ? tableauTop + acc : floor - cardH - acc;
      ys.push(y);
      const isTop = idx === pile.length - 1;
      const folded = !!fan.bundle && idx >= fan.bundle.start && idx < fan.bundle.start + fan.bundle.count;
      cards.push({
        id: card.id, x, y, z: idx, faceUp: card.faceUp, pile: T(p), index: idx, folded,
        strip: isTop ? cardH : (fan.offsets[idx] ?? 0), grow: slot.grow,
      });
      acc += fan.offsets[idx] ?? 0;
    });

    if (fan.bundle) {
      const { start, count } = fan.bundle;
      const y0 = ys[start] ?? 0;
      const y1 = ys[start + count] ?? y0;
      const top = Math.min(y0, y1);
      const h = Math.abs(y1 - y0);
      bundles.push({
        pile: p,
        count,
        rect: slot.grow === 'down' ? { x, y: top, w: cardW, h } : { x, y: top + cardH, w: cardW, h },
      });
    }

    // Drop target: the pile's whole share of its column (at least one card tall).
    const span = Math.max(alloc + STACK_GAP / 2, cardH);
    const rect: Rect =
      slot.grow === 'down' ? { x, y: tableauTop, w: cardW, h: span } : { x, y: floor - span, w: cardW, h: span };
    targets.push({ ref: T(p), rect });
  });

  return {
    metrics: m,
    cards,
    targets,
    bundles,
    slots: { foundations, tableau: tableauSlots, waste, stock, undo, restart, appearance },
    allocations,
  };
}
