/**
 * Fanning and compression (TAD §9.4). Pure functions of pile shape and metrics.
 *
 * offsets[i] is the visible strip of card i (the distance from card i to card
 * i + 1). The top card has no offset; it is shown in full.
 *
 * Fitting order when a stack is taller than its space:
 *   1. tighten all offsets evenly, down to the minimums;
 *   2. fold the middle of the face-up run into a bundle of 3 px strips,
 *      always keeping the first face-up card and the last 3 cards readable;
 *   3. (last resort, not reachable on supported phones) squeeze face-down strips.
 */
import { FOLD_STRIP, type Metrics } from './metrics';

export interface StackShape {
  readonly down: number;
  readonly up: number;
}

export interface Bundle {
  /** Pile index of the first folded card. */
  readonly start: number;
  readonly count: number;
}

export interface Fan {
  readonly offsets: readonly number[];
  readonly height: number;
  readonly bundle: Bundle | null;
}

/** Cards kept unfolded at the end of a run (including the playable top card). */
const KEEP_TAIL = 3;

export function stackHeight(shape: StackShape, cardH: number, down: number, up: number): number {
  if (shape.down + shape.up === 0) return 0;
  return cardH + shape.down * down + Math.max(0, shape.up - 1) * up;
}

export function naturalHeight(shape: StackShape, m: Metrics): number {
  return stackHeight(shape, m.cardH, m.offsets.down, m.offsets.up);
}

function build(shape: StackShape, down: number, up: number, foldFrom = 0, foldCount = 0): number[] {
  const n = shape.down + shape.up;
  const offsets: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1) offsets.push(0);
    else if (i < shape.down) offsets.push(down);
    else if (foldCount > 0 && i >= foldFrom && i < foldFrom + foldCount) offsets.push(FOLD_STRIP);
    else offsets.push(up);
  }
  return offsets;
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Fit a stack into `avail` px of height. */
export function fitStack(shape: StackShape, avail: number, m: Metrics): Fan {
  const n = shape.down + shape.up;
  if (n === 0) return { offsets: [], height: 0, bundle: null };
  const { down, up, downMin, upMin } = m.offsets;

  const hNatural = stackHeight(shape, m.cardH, down, up);
  if (hNatural <= avail) return { offsets: build(shape, down, up), height: hNatural, bundle: null };

  const hMin = stackHeight(shape, m.cardH, downMin, upMin);
  if (hMin <= avail) {
    const t = (avail - hMin) / (hNatural - hMin);
    const offsets = build(shape, downMin + t * (down - downMin), upMin + t * (up - upMin));
    return { offsets, height: m.cardH + sum(offsets), bundle: null };
  }

  // Fold the middle of the face-up run: keep the first face-up card and the last KEEP_TAIL.
  const maxFold = Math.max(0, shape.up - 1 - KEEP_TAIL);
  const perFold = upMin - FOLD_STRIP;
  const count = Math.min(maxFold, Math.ceil((hMin - avail) / perFold));
  const start = shape.down + 1;
  let offsets = build(shape, downMin, upMin, start, count);
  let height = m.cardH + sum(offsets);

  // Folding saves space in whole-card steps, so it usually overshoots. Give the
  // leftover back to the unfolded face-up strips (never above natural spacing).
  const unfoldedUp = shape.up - 1 - count;
  if (height < avail && unfoldedUp > 0) {
    const roomier = Math.min(up, upMin + (avail - height) / unfoldedUp);
    offsets = build(shape, downMin, roomier, start, count);
    height = m.cardH + sum(offsets);
  }

  if (height > avail && shape.down > 0) {
    // Last resort: squeeze the face-down strips (never below 2 px).
    const spare = height - avail;
    const squeezed = Math.max(2, downMin - spare / shape.down);
    offsets = build(shape, squeezed, upMin, start, count);
    height = m.cardH + sum(offsets);
  }
  return { offsets, height, bundle: count > 0 ? { start, count } : null };
}

/**
 * Split a shared column between a top stack and a reversed bottom stack
 * (TAD §9.4). Returns the height given to each. Their sum plus STACK_GAP never
 * exceeds the column, so the two rows can never overlap.
 */
export function splitColumn(top: StackShape, bottom: StackShape, avail: number, m: Metrics): [number, number] {
  const hTop = naturalHeight(top, m);
  const hBot = naturalHeight(bottom, m);
  if (hTop + hBot <= avail) {
    // Everything fits: share the free space in proportion, treating an empty pile as one card for drop targets.
    const wT = Math.max(hTop, m.cardH);
    const wB = Math.max(hBot, m.cardH);
    const a = Math.min(avail - hBot, Math.max(hTop, (avail * wT) / (wT + wB)));
    return [a, avail - a];
  }
  const minShare = 0.4 * avail;
  let a = (avail * hTop) / (hTop + hBot);
  a = Math.max(a, Math.min(hTop, minShare));
  a = Math.min(a, avail - Math.min(hBot, minShare));
  return [a, avail - a];
}
