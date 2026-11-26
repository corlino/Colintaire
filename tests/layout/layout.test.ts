import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { dealBoard, type Board, type Card, type Pile, type Rank, type Suit } from '../../src/engine';
import {
  computeLayout,
  computeMetrics,
  fitStack,
  STACK_GAP,
  type CardPlacement,
  type Rect,
} from '../../src/layout';
import { boardArea, DEVICES } from '../../src/ui/shellSizes';

const EPS = 1e-6;
const bottomOf = (m: { cardH: number }, c: CardPlacement) => c.y + m.cardH;

/** Synthetic pile: `down` face-down cards then `up` face-up cards. Ids only need to be unique. */
let uid = 0;
function pile(down: number, up: number): Pile {
  const cards: Card[] = [];
  for (let i = 0; i < down + up; i++) {
    cards.push({ id: `X${uid++}`, suit: 'S' as Suit, rank: 1 as Rank, faceUp: i >= down });
  }
  return cards;
}

function boardWith(shapes: [number, number][]): Board {
  return {
    stock: pile(0, 0),
    waste: pile(0, 0),
    foundations: [[], [], [], []],
    tableau: shapes.map(([d, u]) => pile(d, u)) as unknown as Board['tableau'],
  };
}

describe('metrics (TAD §9.2)', () => {
  it.each(Object.entries(DEVICES))('%s: five columns fit with no horizontal overflow', (_name, dev) => {
    const { width, height } = boardArea(dev);
    const m = computeMetrics(width, height);
    expect(m.boardW).toBeLessThanOrEqual(width);
    expect(m.cardH).toBe(Math.round(m.cardW * 1.4));
    expect(m.rankFont).toBeGreaterThanOrEqual(15);
    expect(m.rankFont).toBeLessThanOrEqual(19);
  });

  it('matches the TAD worked example on iPhone 13 mini width', () => {
    const m = computeMetrics(343, 560);
    expect(m.gap).toBe(8);
    expect(m.cardW).toBe(62);
    expect(m.cardH).toBe(87);
  });

  it('caps the board width on desktop so cards stay ≤ ~90 px', () => {
    const m = computeMetrics(1400, 900);
    expect(m.boardW).toBeLessThanOrEqual(520);
    expect(m.cardW).toBeLessThanOrEqual(95);
  });

  it('shrinks cards on short windows so the tableau keeps 3.2 card heights', () => {
    const m = computeMetrics(480, 360);
    expect(360 - m.cardH - 16).toBeGreaterThanOrEqual(3.2 * m.cardH);
  });
});

describe('fitStack (TAD §9.4)', () => {
  const m = computeMetrics(343, 560);
  it('uses natural spacing when there is room', () => {
    const f = fitStack({ down: 2, up: 3 }, 1000, m);
    expect(f.offsets).toEqual([m.offsets.down, m.offsets.down, m.offsets.up, m.offsets.up, 0]);
    expect(f.bundle).toBeNull();
  });
  it('tightens evenly before folding', () => {
    const f = fitStack({ down: 0, up: 13 }, 300, m);
    expect(f.bundle).toBeNull();
    expect(f.height).toBeCloseTo(300);
    expect(Math.min(...f.offsets.slice(0, -1))).toBeGreaterThanOrEqual(m.offsets.upMin - EPS);
  });
  it('folds the middle of a long run, keeping the first and last three cards', () => {
    const f = fitStack({ down: 1, up: 13 }, 200, m);
    expect(f.height).toBeLessThanOrEqual(200 + EPS);
    expect(f.bundle).not.toBeNull();
    expect(f.bundle!.start).toBe(2);
    expect(f.bundle!.start + f.bundle!.count).toBeLessThanOrEqual(14 - 3);
  });
});

describe('computeLayout on a real deal', () => {
  const { width, height } = boardArea(DEVICES['iPhone 13 mini']!);
  const m = computeMetrics(width, height);
  const layout = computeLayout(dealBoard(42), m);

  it('places all 52 cards', () => {
    expect(new Set(layout.cards.map((c) => c.id)).size).toBe(52);
  });
  it('draws piles 6–7 reversed: top card highest, anchored to the floor (AC 3)', () => {
    for (const p of [5, 6]) {
      const cs = layout.cards.filter((c) => c.pile.kind === 'tableau' && c.pile.index === p);
      const top = cs[cs.length - 1]!;
      expect(Math.min(...cs.map((c) => c.y))).toBe(top.y);
      expect(cs[0]!.y + m.cardH).toBeCloseTo(m.floor);
    }
  });
  it('draws piles 1–5 downward from the tableau top', () => {
    for (const p of [0, 1, 2, 3, 4]) {
      const cs = layout.cards.filter((c) => c.pile.kind === 'tableau' && c.pile.index === p);
      expect(cs[0]!.y).toBe(m.tableauTop);
      expect(Math.max(...cs.map((c) => c.y))).toBe(cs[cs.length - 1]!.y);
    }
  });
});

// ---------------------------------------------------------------- guarantee test (U19)

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;

describe('no-overlap guarantee (U19)', () => {
  // Pile p can hold at most p face-down cards and a 13-card face-up run.
  const shapeArb = (p: number) =>
    fc.tuple(fc.integer({ min: 0, max: p }), fc.integer({ min: 0, max: 13 })).map(([d, u]): [number, number] =>
      u === 0 ? [0, 0] : [d, u],
    );
  const boardArb = fc.tuple(...[0, 1, 2, 3, 4, 5, 6].map(shapeArb));

  for (const [name, dev] of Object.entries(DEVICES)) {
    it(`${name}: rows never overlap, cards stay in the board, and unfolded cards show their index`, () => {
      const { width, height } = boardArea(dev);
      const m = computeMetrics(width, height);
      fc.assert(
        fc.property(boardArb, (shapes) => {
          const layout = computeLayout(boardWith(shapes), m);
          const rectOf = (c: CardPlacement): Rect => ({ x: c.x, y: c.y, w: m.cardW, h: m.cardH });
          const tab = (p: number) => layout.cards.filter((c) => c.pile.kind === 'tableau' && c.pile.index === p);
          const topRow = [0, 1, 2, 3, 4].flatMap(tab);
          const bottomRow = [5, 6].flatMap(tab);
          const bottomFixed = [layout.slots.waste, layout.slots.stock, layout.slots.undo, layout.slots.appearance];

          for (const a of topRow) {
            for (const b of bottomRow) expect(overlaps(rectOf(a), rectOf(b))).toBe(false);
            for (const r of bottomFixed) expect(overlaps(rectOf(a), r)).toBe(false);
            expect(a.y).toBeGreaterThanOrEqual(m.tableauTop - EPS);
          }
          // Shared columns keep the 8 px clear gap.
          for (const [tp, bp] of [[0, 5], [1, 6]] as const) {
            const t = tab(tp);
            const b = tab(bp);
            if (t.length && b.length) {
              const tBottom = Math.max(...t.map((c) => bottomOf(m, c)));
              const bTop = Math.min(...b.map((c) => c.y));
              expect(bTop - tBottom).toBeGreaterThanOrEqual(STACK_GAP - EPS);
            }
          }
          for (const c of layout.cards) {
            expect(c.x).toBeGreaterThanOrEqual(0);
            expect(c.x + m.cardW).toBeLessThanOrEqual(m.boardW + EPS);
            expect(c.y).toBeGreaterThanOrEqual(-EPS);
            expect(c.y + m.cardH).toBeLessThanOrEqual(m.floor + EPS);
            if (c.faceUp && !c.folded) expect(c.strip).toBeGreaterThanOrEqual(m.offsets.upMin - EPS);
          }
        }),
        { numRuns: 400 },
      );
    });
  }
});
