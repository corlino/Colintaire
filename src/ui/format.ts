import { FOUNDATION_SUITS } from '../engine/constants';
import type { PileRef } from '../engine/types';

/** Vegas balance: "$51", "−$52" with a true minus sign (decision U16). */
export function formatVegas(amount: number): string {
  const abs = Math.abs(amount);
  return amount < 0 ? `−$${abs}` : `$${abs}`;
}

/** Elapsed time as m:ss, switching to h:mm:ss after an hour (TAD §11.1). */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export const RANK_LABEL: Record<number, string> = {
  1: 'A', 11: 'J', 12: 'Q', 13: 'K',
};
export const rankLabel = (rank: number) => RANK_LABEL[rank] ?? String(rank);

export const SUIT_NAME = { S: 'spades', H: 'hearts', C: 'clubs', D: 'diamonds' } as const;

/** Spoken names for piles (screen readers and keyboard play). */
export function pileName(ref: PileRef): string {
  if (ref.kind === 'tableau') return `pile ${ref.index + 1}`;
  if (ref.kind === 'foundation') return `${SUIT_NAME[FOUNDATION_SUITS[ref.index]!]} foundation`;
  return ref.kind;
}
