/**
 * npm run assets — turns the owner's PNGs in art/ into optimised files (TAD §12.5).
 *
 *   art/themes/<id>/background.png        → public/art/themes/<id>/background.webp       (or the folder's only image)
 *   art/themes/<id>/background-wide.png   → public/art/themes/<id>/background-wide.webp   (optional)
 *   art/card-backs/<id>/back.png          → public/art/card-backs/<id>/back.webp   (or the folder's only image)
 *   art/card-faces/<set>/S01.png … D13.png → public/art/card-faces/<set>/S01.webp …   (all 52 required)
 *   Backs and faces also get a full-size copy in …/large/ for the inspect view (not precached).
 *   Its URL carries ?v=<content hash>, so new art gets a new URL and never comes from an old cache.
 *   art/brand/<name>.png                  → public/art/brand/<name>.webp  (trimmed, transparent, 256 px tall; e.g. logo-silver, mask-silver)
 *   art/icons/icon-1024.png               → public/icons/*.png   (placeholder from the card back otherwise)
 *
 * It also writes src/assets/generated.ts, which the registry reads: a theme or
 * card back that has art uses it, and a new folder appears in Appearance on its own.
 * Never put raw PNGs straight into public/.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** `url?v=<first 8 hex of the file's SHA-256>`: changes whenever the image does. */
const versioned = (url, file) => `${url}?v=${createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8)}`;

const BG = '#101010';
const SUITS = ['S', 'H', 'C', 'D'];
const FACE_IDS = SUITS.flatMap((s) => Array.from({ length: 13 }, (_, i) => `${s}${String(i + 1).padStart(2, '0')}`));

/** Output sizes. Cards: ~90 CSS px wide at most × 3 DPR. Backgrounds: iPhone Pro Max at 3×. */
export const SIZES = {
  background: { width: 1290, height: 2796 },
  backgroundWide: { width: 2560, height: 1440 },
  card: { width: 300, height: 420 },
  /** Full-size copy for the inspect view; fetched only when a card is opened large. */
  cardLarge: { width: 750, height: 1050 },
  logoHeight: 256,
};

const subdirs = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => d.name)
        .sort()
    : [];

const IMAGE = /\.(png|jpe?g|webp)$/i;

/** The named file, or else the folder's only image (PNG, JPEG or WebP) whatever its name. */
function soleImage(dir, preferred, exclude = []) {
  if (existsSync(join(dir, preferred))) return join(dir, preferred);
  const images = readdirSync(dir).filter((f) => IMAGE.test(f) && !exclude.includes(f.toLowerCase()));
  return images.length === 1 ? join(dir, images[0]) : null;
}

/** Brightest average a background may show through its scrim, so white text and controls stay readable. */
export const MAX_BG_LUMINANCE = 0.3;
const DEFAULT_SCRIM_ALPHA = 0.25; // matches the registry default

/** A darker scrim for a bright background (null when the default is enough). */
async function scrimFor(file) {
  const [r, g, b] = (await sharp(file).stats()).channels.map((c) => c.mean / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const alpha = 1 - MAX_BG_LUMINANCE / luminance;
  return alpha > DEFAULT_SCRIM_ALPHA ? `rgba(0, 0, 0, ${Math.ceil(alpha * 100) / 100})` : null;
}

async function webp(src, dest, resize, quality = 82) {
  await sharp(src).rotate().resize({ ...resize, fit: 'cover', position: 'centre' }).webp({ quality }).toFile(dest);
}

async function checkSize(src, want, warnings) {
  const { width, height } = await sharp(src).metadata();
  if (width !== want.width || height !== want.height) warnings.push(`${src} is ${width}×${height}; expected ${want.width}×${want.height}. It will be cropped to fit.`);
}

/** Build everything. Paths are parameters so tests can run against fixtures. */
export async function buildAssets({ artDir = 'art', publicDir = 'public', manifestPath = 'src/assets/generated.ts', iconSource = 'src/assets/placeholders/teal-geometric.svg', log = console.log } = {}) {
  const warnings = [];
  const out = { themes: {}, cardBacks: {}, cardBacksLarge: {}, cardFaces: {}, cardFacesLarge: {}, brand: {} };
  const artOut = join(publicDir, 'art');
  rmSync(artOut, { recursive: true, force: true }); // no stale files from removed art

  for (const id of subdirs(join(artDir, 'themes'))) {
    const src = soleImage(join(artDir, 'themes', id), 'background.png', ['background-wide.png']);
    if (!src) continue;
    const dir = join(artOut, 'themes', id);
    mkdirSync(dir, { recursive: true });
    await checkSize(src, SIZES.background, warnings);
    await webp(src, join(dir, 'background.webp'), SIZES.background, 78);
    const entry = { background: `/art/themes/${id}/background.webp` };
    const scrim = await scrimFor(join(dir, 'background.webp'));
    if (scrim) entry.scrim = scrim;
    const wide = join(artDir, 'themes', id, 'background-wide.png');
    if (existsSync(wide)) {
      await checkSize(wide, SIZES.backgroundWide, warnings);
      await webp(wide, join(dir, 'background-wide.webp'), SIZES.backgroundWide, 78);
      entry.backgroundWide = `/art/themes/${id}/background-wide.webp`;
    }
    out.themes[id] = entry;
    log(`theme ${id}`);
  }

  for (const id of subdirs(join(artDir, 'card-backs'))) {
    const src = soleImage(join(artDir, 'card-backs', id), 'back.png');
    if (!src) continue;
    const dir = join(artOut, 'card-backs', id);
    mkdirSync(dir, { recursive: true });
    await checkSize(src, { width: 750, height: 1050 }, warnings);
    await webp(src, join(dir, 'back.webp'), SIZES.card, 85);
    mkdirSync(join(dir, 'large'), { recursive: true });
    await webp(src, join(dir, 'large', 'back.webp'), SIZES.cardLarge, 85);
    out.cardBacks[id] = `/art/card-backs/${id}/back.webp`;
    out.cardBacksLarge[id] = versioned(`/art/card-backs/${id}/large/back.webp`, join(dir, 'large', 'back.webp'));
    log(`card back ${id}`);
  }

  for (const id of subdirs(join(artDir, 'card-faces'))) {
    const srcDir = join(artDir, 'card-faces', id);
    const missing = FACE_IDS.filter((f) => !existsSync(join(srcDir, `${f}.png`)));
    if (missing.length > 0) {
      warnings.push(`card faces "${id}" skipped: missing ${missing.length} of 52 (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ', …' : ''}).`);
      continue;
    }
    const dir = join(artOut, 'card-faces', id);
    mkdirSync(join(dir, 'large'), { recursive: true });
    const images = {};
    const large = {};
    for (const f of FACE_IDS) {
      await webp(join(srcDir, `${f}.png`), join(dir, `${f}.webp`), SIZES.card, 85);
      await webp(join(srcDir, `${f}.png`), join(dir, 'large', `${f}.webp`), SIZES.cardLarge, 85);
      images[f] = `/art/card-faces/${id}/${f}.webp`;
      large[f] = versioned(`/art/card-faces/${id}/large/${f}.webp`, join(dir, 'large', `${f}.webp`));
    }
    out.cardFaces[id] = images;
    out.cardFacesLarge[id] = large;
    log(`card faces ${id}`);
  }

  // Brand marks: transparent PNGs, trimmed to the artwork so the UI controls the spacing.
  const brandDir = join(artDir, 'brand');
  if (existsSync(brandDir)) {
    for (const file of readdirSync(brandDir).filter((f) => /^[a-z0-9-]+\.png$/.test(f)).sort()) {
      const name = file.slice(0, -'.png'.length);
      const dir = join(artOut, 'brand');
      mkdirSync(dir, { recursive: true });
      const trimmed = await sharp(join(brandDir, file)).trim().toBuffer();
      await sharp(trimmed).resize({ height: SIZES.logoHeight }).webp({ quality: 90, alphaQuality: 100 }).toFile(join(dir, `${name}.webp`));
      const { width, height } = await sharp(trimmed).metadata();
      out.brand[name] = { src: `/art/brand/${name}.webp`, aspect: Math.round((width / height) * 1000) / 1000 };
      log(`brand ${name}`);
    }
  }

  await buildIcons({ artDir, publicDir, iconSource, log });

  const body = `/* Generated by \`npm run assets\` — do not edit. Lists the optimised art in public/art. */
export interface GeneratedTheme {
  readonly background: string;
  readonly backgroundWide?: string;
  /** Darker scrim, set when the background is bright. */
  readonly scrim?: string;
}

export const GENERATED: {
  readonly themes: Readonly<Record<string, GeneratedTheme>>;
  readonly cardBacks: Readonly<Record<string, string>>;
  /** Full-size (750 × 1050) backs and faces for the inspect view. */
  readonly cardBacksLarge: Readonly<Record<string, string>>;
  readonly cardFaces: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly cardFacesLarge: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Brand marks by name (e.g. "silver"); aspect is width / height. */
  readonly brand: Readonly<Record<string, { readonly src: string; readonly aspect: number }>>;
} = ${JSON.stringify(out, null, 2)};
`;
  writeFileSync(manifestPath, body);
  for (const w of warnings) log(`warning: ${w}`);
  return { manifest: out, warnings };
}

/** App icons. Uses art/icons/icon-1024.png when supplied, else the card back on #101010. */
async function buildIcons({ artDir, publicDir, iconSource, log }) {
  const outDir = join(publicDir, 'icons');
  mkdirSync(outDir, { recursive: true });
  const supplied = join(artDir, 'icons', 'icon-1024.png');

  const master = async (inset) => {
    let art;
    if (existsSync(supplied)) {
      const size = Math.round(1024 * inset);
      art = await sharp(supplied).resize(size, size).toBuffer();
    } else {
      const h = Math.round(1024 * inset);
      const w = Math.round((h * 5) / 7);
      const card = await sharp(readFileSync(iconSource), { density: 600 }).resize(w, h, { fit: 'fill' }).png().toBuffer();
      const r = Math.round(w * 0.08);
      const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);
      art = await sharp(card).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    }
    return sharp({ create: { width: 1024, height: 1024, channels: 3, background: BG } })
      .composite([{ input: art, gravity: 'centre' }])
      .png()
      .toBuffer();
  };

  // A supplied icon fills the canvas (iOS rounds the corners); the maskable one keeps the art in the safe zone.
  const standard = await master(existsSync(supplied) ? 1 : 0.8);
  const maskable = await master(existsSync(supplied) ? 1 : 0.6); // supplied art already sits in the central safe zone
  const outputs = [
    ['icon-192.png', standard, 192],
    ['icon-512.png', standard, 512],
    ['icon-maskable-512.png', maskable, 512],
    ['apple-touch-icon.png', standard, 180],
    ['favicon-32.png', standard, 32],
  ];
  for (const [name, src, size] of outputs) {
    // No palette quantisation: gradients would band.
    await sharp(src).resize(size, size).png({ compressionLevel: 9 }).toFile(join(outDir, name));
  }
  log(`icons (${existsSync(supplied) ? 'from art/icons/icon-1024.png' : 'placeholder'})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildAssets(); // size warnings are advisory and printed above
}
