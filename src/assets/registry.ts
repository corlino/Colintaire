/**
 * Three independent asset registries (PRD 7.4, Style Guide 8.4, TAD §12).
 * To add art, append one entry. No component or engine code changes.
 *
 * Phase 1 ships exactly one of each, as code-made placeholders (decision U23).
 * When the owner drops final PNGs into art/ and runs `npm run assets`, the
 * generated list replaces a placeholder with its art, and a new art folder
 * becomes a new option on its own (TAD §12.5).
 */
import { GENERATED, type GeneratedTheme } from './generated';
import tealGeometric from './placeholders/teal-geometric.svg';

export interface ThemeAsset {
  readonly id: string;
  readonly name: string;
  /** CSS background-image value for the whole app background. */
  readonly background: string;
  /** Optional landscape background for wide windows (desktop). */
  readonly backgroundWide?: string;
  /** Darkening layer over the background so cards stay readable. */
  readonly scrim: string;
  /** CSS background for previews. Painted into a portrait screen-shaped box, then centre-cropped to a circle. */
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

const DEFAULT_SCRIM = 'rgba(0, 0, 0, 0.25)';

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
  scrim: DEFAULT_SCRIM,
  preview: nebulaDuskLayers.join(', '),
};

const tealGeometricBack: CardBackAsset = { id: 'teal-geometric', name: 'Teal Geometric', src: tealGeometric };

const classicFaces: CardFaceSet = { id: 'classic', name: 'Classic', kind: 'rendered' };

/** "nebula-dusk" → "Nebula Dusk" for folders without a hand-written entry. */
export const titleFromId = (id: string) => id.split(/[-_]/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');

const url = (path: string) => `url("${path}")`;

interface Generated {
  readonly themes: Readonly<Record<string, GeneratedTheme>>;
  readonly cardBacks: Readonly<Record<string, string>>;
  readonly cardFaces: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly brand?: Readonly<Record<string, { readonly src: string; readonly aspect: number }>>;
}

/** Overlay generated art on the hand-written entries; unknown ids become new entries, in folder order. */
export function withArt(
  base: { themes: readonly ThemeAsset[]; backs: readonly CardBackAsset[]; faces: readonly CardFaceSet[] },
  gen: Generated,
) {
  const themeFrom = (id: string, g: GeneratedTheme, prev?: ThemeAsset): ThemeAsset => ({
    id,
    name: prev?.name ?? titleFromId(id),
    scrim: prev?.scrim ?? DEFAULT_SCRIM,
    background: url(g.background),
    ...(g.backgroundWide ? { backgroundWide: url(g.backgroundWide) } : {}),
    preview: `center / cover no-repeat ${url(g.background)}`,
  });
  const themes = base.themes.map((t) => (gen.themes[t.id] ? themeFrom(t.id, gen.themes[t.id]!, t) : t));
  for (const [id, g] of Object.entries(gen.themes)) if (!themes.some((t) => t.id === id)) themes.push(themeFrom(id, g));

  const backs = base.backs.map((b) => (gen.cardBacks[b.id] ? { ...b, src: gen.cardBacks[b.id]! } : b));
  for (const [id, src] of Object.entries(gen.cardBacks)) if (!backs.some((b) => b.id === id)) backs.push({ id, name: titleFromId(id), src });

  const faces = [...base.faces];
  for (const [id, images] of Object.entries(gen.cardFaces)) {
    const i = faces.findIndex((f) => f.id === id);
    const set: CardFaceSet = { id, name: faces[i]?.name ?? titleFromId(id), kind: 'images', images };
    if (i >= 0) faces[i] = set;
    else faces.push(set);
  }
  return { themes, backs, faces };
}

const registries = withArt({ themes: [nebulaDusk], backs: [tealGeometricBack], faces: [classicFaces] }, GENERATED);

export const THEMES: readonly ThemeAsset[] = registries.themes;
export const CARD_BACKS: readonly CardBackAsset[] = registries.backs;
export const CARD_FACES: readonly CardFaceSet[] = registries.faces;

/** Brand mark shown either side of the header title (light version for the dark UI), if supplied. */
export const HEADER_LOGO: { readonly src: string; readonly aspect: number } | undefined = GENERATED.brand['silver'];

export const DEFAULTS = { theme: 'nebula-dusk', back: 'teal-geometric', face: 'classic' } as const;

/** Look up by id, falling back to the default when a saved id no longer exists. */
export function pick<T extends { id: string }>(list: readonly T[], id: string, fallbackId: string): T {
  return list.find((a) => a.id === id) ?? list.find((a) => a.id === fallbackId) ?? (list[0] as T);
}
