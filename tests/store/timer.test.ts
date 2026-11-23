import { describe, expect, it } from 'vitest';
import { elapsedMs, haltTimer, runTimer, syncTimer, TIMER_ZERO } from '../../src/store/timer';

describe('timer model (TAD §11.1)', () => {
  it('accumulates only while running', () => {
    let t = runTimer(TIMER_ZERO, 1000);
    expect(elapsedMs(t, 4000)).toBe(3000);
    t = haltTimer(t, 4000);
    expect(elapsedMs(t, 99_000)).toBe(3000);
    t = runTimer(t, 10_000);
    expect(elapsedMs(t, 12_500)).toBe(5500);
  });

  it('is idempotent for repeated run/halt', () => {
    const t = runTimer(runTimer(TIMER_ZERO, 100), 900);
    expect(t.startedAt).toBe(100);
    const h = haltTimer(haltTimer(t, 600), 5000);
    expect(h).toEqual({ accumulatedMs: 500, startedAt: null });
  });

  it('syncs to the desired running state', () => {
    expect(syncTimer(TIMER_ZERO, true, 50).startedAt).toBe(50);
    expect(syncTimer({ accumulatedMs: 10, startedAt: 50 }, false, 80)).toEqual({ accumulatedMs: 40, startedAt: null });
  });

  it('never goes backwards if the clock does', () => {
    expect(elapsedMs({ accumulatedMs: 1000, startedAt: 5000 }, 4000)).toBe(1000);
  });
});
