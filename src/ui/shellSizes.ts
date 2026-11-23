/**
 * Fixed heights of the app shell around the board. The UI uses these for its
 * CSS, and layout tests use them to compute the board area for real devices.
 */
export const SHELL = {
  header: 72,
  stats: 68,
  /** Gap between the board and the stats panel. */
  statsGap: 12,
  /** Breathing room below the stats panel, above the safe area. */
  bottomPad: 8,
} as const;

export const padXFor = (vw: number) => (vw < 400 ? 16 : 20);

export interface Device {
  readonly vw: number;
  readonly vh: number;
  readonly safeTop: number;
  readonly safeBottom: number;
}

/** Portrait iPhone viewports (CSS px) and safe areas, as a home-screen app. */
export const DEVICES: Record<string, Device> = {
  'iPhone SE': { vw: 375, vh: 667, safeTop: 20, safeBottom: 0 },
  'iPhone 13 mini': { vw: 375, vh: 812, safeTop: 50, safeBottom: 34 },
  'iPhone 15': { vw: 393, vh: 852, safeTop: 59, safeBottom: 34 },
  'iPhone 15 Pro Max': { vw: 430, vh: 932, safeTop: 59, safeBottom: 34 },
};

export function boardArea(d: Device): { width: number; height: number } {
  return {
    width: Math.min(d.vw, 520) - 2 * padXFor(d.vw),
    height: d.vh - d.safeTop - d.safeBottom - SHELL.header - SHELL.stats - SHELL.statsGap - SHELL.bottomPad,
  };
}
