/**
 * Pure hit-testing helpers for tap and drag (TAD §10). The engine stays the
 * only judge of legality; these only find candidate piles.
 */
import { isLegalMove, sameRef } from '../engine/rules';
import type { Board, PileRef } from '../engine/types';
import type { CardPlacement, LayoutResult, Rect } from '../layout';

/** Pointer travel (px) that turns a press into a drag. */
export const DRAG_THRESHOLD = 8;
/** Extra reach (px) around the dragged card when looking for a drop pile. */
export const DROP_TOLERANCE = 12;
/** Two taps on the same card within this window count as a double-tap. */
export const DOUBLE_TAP_MS = 300;

export const isDestination = (ref: PileRef) => ref.kind === 'tableau' || ref.kind === 'foundation';

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const contains = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * The card under a point, using layout positions rather than the DOM, so a
 * card that is still animating into place can be tapped where it is going.
 * Within a pile the higher index is on top; piles never overlap each other.
 */
export function cardAtPoint(layout: LayoutResult, x: number, y: number): CardPlacement | null {
  const { cardW, cardH } = layout.metrics;
  let best: CardPlacement | null = null;
  for (const c of layout.cards) {
    if (x < c.x || x > c.x + cardW || y < c.y || y > c.y + cardH) continue;
    if (!best || c.index > best.index) best = c;
  }
  return best;
}

/** The destination pile under a point (tableau and foundations only). */
export function pileAtPoint(layout: LayoutResult, x: number, y: number): PileRef | null {
  const hit = layout.targets.find((t) => isDestination(t.ref) && contains(t.rect, x, y));
  return hit?.ref ?? null;
}

/**
 * Where should a dragged run land? Candidates are ordered by how much the
 * dragged lead card overlaps each pile's drop rectangle; the first legal one wins.
 * Returns null when nothing legal is under the card.
 */
export function pickDropTarget(
  board: Board,
  layout: LayoutResult,
  from: PileRef,
  cardIndex: number,
  lead: Rect,
): PileRef | null {
  const reach: Rect = {
    x: lead.x - DROP_TOLERANCE,
    y: lead.y - DROP_TOLERANCE,
    w: lead.w + 2 * DROP_TOLERANCE,
    h: lead.h + 2 * DROP_TOLERANCE,
  };
  const ranked = layout.targets
    .filter((t) => isDestination(t.ref) && !sameRef(t.ref, from))
    .map((t) => ({ ref: t.ref, area: overlapArea(reach, t.rect) }))
    .filter((t) => t.area > 0)
    .sort((a, b) => b.area - a.area);
  return ranked.find((t) => isLegalMove(board, from, cardIndex, t.ref))?.ref ?? null;
}

/** The rectangle a moved card would land on, for valid-destination highlights. */
export function landingRect(layout: LayoutResult, ref: PileRef): Rect | null {
  const { cardW, cardH } = layout.metrics;
  if (ref.kind === 'foundation') return layout.slots.foundations[ref.index] ?? null;
  if (ref.kind !== 'tableau') return null;
  const cards = layout.cards.filter((c) => c.pile.kind === 'tableau' && c.pile.index === ref.index);
  const top = cards[cards.length - 1];
  if (top) return { x: top.x, y: top.y, w: cardW, h: cardH };
  return layout.slots.tableau[ref.index]?.rect ?? null;
}

/** Every pile the run starting at (from, cardIndex) could legally move to. */
export function legalDestinations(board: Board, layout: LayoutResult, from: PileRef, cardIndex: number): PileRef[] {
  return layout.targets
    .map((t) => t.ref)
    .filter((ref) => isDestination(ref) && isLegalMove(board, from, cardIndex, ref));
}
