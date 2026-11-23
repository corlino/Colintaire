/**
 * Timer model (TAD §11.1). Stores accumulated time, not ticks, so it stays
 * accurate across pauses, backgrounding and reloads.
 */
export interface TimerState {
  readonly accumulatedMs: number;
  /** Wall-clock ms when the current running stretch began; null while paused. */
  readonly startedAt: number | null;
}

export type PauseReason = 'modal' | 'hidden' | 'rotate';

export const TIMER_ZERO: TimerState = { accumulatedMs: 0, startedAt: null };

export function runTimer(t: TimerState, now: number): TimerState {
  return t.startedAt === null ? { ...t, startedAt: now } : t;
}

export function haltTimer(t: TimerState, now: number): TimerState {
  if (t.startedAt === null) return t;
  return { accumulatedMs: t.accumulatedMs + Math.max(0, now - t.startedAt), startedAt: null };
}

export function elapsedMs(t: TimerState, now: number): number {
  return t.accumulatedMs + (t.startedAt === null ? 0 : Math.max(0, now - t.startedAt));
}

/** Run only while the game is in play and nothing is pausing it. */
export function syncTimer(t: TimerState, shouldRun: boolean, now: number): TimerState {
  return shouldRun ? runTimer(t, now) : haltTimer(t, now);
}
