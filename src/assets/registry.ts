/**
 * Three independent asset registries (PRD 7.4, Style Guide 8.4, TAD §12).
 * To add art, append one entry. No component or engine code changes.
 *
 * Phase 1 ships exactly one of each, as code-made placeholders (decision U23).
 * When the owner drops final PNGs into art/, run the asset script and point
 * the entry's `background` / `src` at the optimised file.
 */
import tealGeometric from './placeholders/teal-geometric.svg';

export interface ThemeAsset {
  readonly id: string;
  readonly name: string;
  /** CSS background-image value for the whole app background. */
  readonly background: string;
  /** Darkening layer over the background so cards stay readable. */
  readonly scrim: string;
  /** CSS background for the circular preview swatch. */
  readonly preview: string;
}

export interface CardBackAsset {
  readonly id: string;
  readonly name: string;
  /** Image URL, 5:7 ratio. */
  readonly src: string;
}

export interface CardFaceSet {
  readonly id: string;
  readonly name: string;
  /** 'rendered' draws faces in code; 'images' (future) uses 52 files keyed S01…D13. */
  readonly kind: 'rendered' | 'images';
  readonly images?: Readonly<Record<string, string>>;
}

const noise =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.45 0 0 0 0 0.4 0 0 0 0.09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const nebulaDuskLayers = [
  'radial-gradient(ellipse 70% 45% at 25% 30%, rgba(122, 96, 70, 0.55), transparent 70%)',
  'radial-gradient(ellipse 60% 50% at 80% 65%, rgba(88, 84, 92, 0.5), transparent 70%)',
  'radial-gradient(ellipse 90% 40% at 50% 95%, rgba(70, 55, 42, 0.45), transparent 70%)',
  'radial-gradient(ellipse 50% 35% at 65% 15%, rgba(140, 130, 120, 0.22), transparent 70%)',
  'linear-gradient(160deg, #1a1714 0%, #121212 45%, #0d0c0b 100%)',
];

/** Placeholder theme "Nebula Dusk": dark charcoal, grey and muted brown haze. */
const nebulaDusk: ThemeAsset = {
  id: 'nebula-dusk',
  name: 'Nebula Dusk',
  background: [noise, ...nebulaDuskLayers].join(', '),
  scrim: 'rgba(0, 0, 0, 0.25)',
  preview: nebulaDuskLayers.join(', '),
};

const tealGeometricBack: CardBackAsset = { id: 'teal-geometric', name: 'Teal Geometric', src: tealGeometric };

const classicFaces: CardFaceSet = { id: 'classic', name: 'Classic', kind: 'rendered' };

export const THEMES: readonly ThemeAsset[] = [nebulaDusk];
export const CARD_BACKS: readonly CardBackAsset[] = [tealGeometricBack];
export const CARD_FACES: readonly CardFaceSet[] = [classicFaces];

export const DEFAULTS = { theme: 'nebula-dusk', back: 'teal-geometric', face: 'classic' } as const;

/** Look up by id, falling back to the default when a saved id no longer exists. */
export function pick<T extends { id: string }>(list: readonly T[], id: string, fallbackId: string): T {
  return list.find((a) => a.id === id) ?? list.find((a) => a.id === fallbackId) ?? (list[0] as T);
}
