/**
 * localStorage persistence (TAD §14). Three schema-versioned records:
 *
 *   colintaire:settings:v1  { themeId, cardBackId, cardFaceId, lastMode }   on change
 *   colintaire:vegas:v1     { settled }                                     when the ledger changes
 *   colintaire:game:v1      { state: GameState, timer: TimerState }         debounced 250 ms, at once on hide
 *
 * Every read and write is wrapped in try/catch (private browsing, full quota).
 * A record that fails validation is discarded and the caller falls back to
 * defaults: a corrupt save must never stop the app launching.
 */
import { assertInvariants, type GameMode, type GameState } from '../engine';
import type { VegasLedger } from './session';
import type { TimerState } from './timer';

export const KEYS = {
  settings: 'colintaire:settings:v1',
  vegas: 'colintaire:vegas:v1',
  game: 'colintaire:game:v1',
} as const;

export const SCHEMA = 1;
export const SAVE_DEBOUNCE_MS = 250;

export interface SavedSettings {
  readonly themeId: string;
  readonly cardBackId: string;
  readonly cardFaceId: string;
  readonly lastMode: GameMode;
}

export interface SavedGame {
  readonly state: GameState;
  /** Always stored halted: time while the app is closed never counts. */
  readonly timer: TimerState;
}

export interface Saved {
  readonly settings: SavedSettings | null;
  readonly vegas: VegasLedger | null;
  readonly game: SavedGame | null;
}

type Validator<T> = (data: unknown) => T | null;

/** The storage to use, or null when none is available (SSR, sandboxed iframes, some private modes). */
export function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function warn(msg: string, err?: unknown) {
  if (import.meta.env.DEV) console.warn(`[persistence] ${msg}`, err ?? '');
}

/** Read one record. Wrong schema, bad JSON or a failed validator all return null and drop the record. */
export function load<T>(storage: Storage | null, key: string, validate: Validator<T>): T | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch (e) {
    warn(`could not read ${key}`, e);
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || parsed.v !== SCHEMA) throw new Error('unknown schema');
    const value = validate(parsed.data);
    if (value === null) throw new Error('failed validation');
    return value;
  } catch (e) {
    warn(`discarding ${key}`, e);
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** Write one record. Returns false if storage refused it. */
export function save(storage: Storage | null, key: string, data: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify({ v: SCHEMA, data }));
    return true;
  } catch (e) {
    warn(`could not write ${key}`, e);
    return false;
  }
}

// ---------------------------------------------------------------- validators

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isMode = (x: unknown): x is GameMode => x === 'classic' || x === 'vegas' || x === 'trini';

export const validateSettings: Validator<SavedSettings> = (d) => {
  if (!isObject(d)) return null;
  const { themeId, cardBackId, cardFaceId, lastMode } = d;
  if (typeof themeId !== 'string' || typeof cardBackId !== 'string' || typeof cardFaceId !== 'string' || !isMode(lastMode)) return null;
  return { themeId, cardBackId, cardFaceId, lastMode };
};

export const validateVegas: Validator<VegasLedger> = (d) => {
  if (!isObject(d) || !isNum(d.settled) || !Number.isInteger(d.settled)) return null;
  return { settled: d.settled };
};

const isCardIdList = (x: unknown) => Array.isArray(x) && x.every((v) => typeof v === 'string');

/** Shape check, then the engine's own invariants (52 unique cards, valid runs and foundations). */
export const validateGame: Validator<SavedGame> = (d) => {
  if (!isObject(d) || !isObject(d.state) || !isObject(d.timer)) return null;
  const s = d.state;
  const t = d.timer;
  if (!isNum(t.accumulatedMs) || t.accumulatedMs < 0) return null;
  if (!isNum(s.seed) || !isMode(s.mode) || !isNum(s.moves) || (s.status !== 'playing' && s.status !== 'won')) return null;
  if (!isObject(s.board) || !isObject(s.classic) || !isObject(s.vegas) || !isObject(s.undo)) return null;
  const b = s.board;
  if (!Array.isArray(b.stock) || !Array.isArray(b.waste) || !Array.isArray(b.foundations) || !Array.isArray(b.tableau)) return null;
  if (b.foundations.length !== 4 || b.tableau.length !== 7) return null;
  if (!isNum(s.classic.points) || !isNum(s.classic.undoPenalty)) return null;
  if (!isCardIdList(s.vegas.credited) || !isCardIdList(s.vegas.everPaid)) return null;
  if (!isNum(s.undo.used) || !Array.isArray(s.undo.history)) return null;
  const state = s as unknown as GameState;
  assertInvariants(state); // throws → caught in load() → record discarded
  for (const snap of state.undo.history) assertInvariants({ ...state, board: snap.board, status: snap.status });
  return { state, timer: { accumulatedMs: t.accumulatedMs, startedAt: null } };
};

/** Read everything saved; each record falls back to null on its own. */
export function loadAll(storage: Storage | null = defaultStorage()): Saved {
  return {
    settings: load(storage, KEYS.settings, validateSettings),
    vegas: load(storage, KEYS.vegas, validateVegas),
    game: load(storage, KEYS.game, validateGame),
  };
}

/** Ask the browser not to evict our storage (TAD §14: WebKit tends to grant this to Home Screen apps). */
export function requestPersistentStorage() {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* unsupported */
  }
}
