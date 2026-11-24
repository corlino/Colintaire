import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAssets, SIZES } from '../../scripts/assets.mjs';
import { CARD_BACKS, THEMES, titleFromId, withArt } from '../../src/assets/registry';

const png = (path: string, width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#335577' } }).png().toFile(path);

let root: string;
let result: Awaited<ReturnType<typeof buildAssets>>;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'colintaire-assets-'));
  const art = join(root, 'art');
  const dirs = ['themes/nebula-dusk', 'themes/deep-sea', 'themes/photo', 'card-backs/teal-geometric', 'card-backs/odd-name', 'card-faces/partial', 'card-faces/full', 'brand', 'icons'];
  for (const d of dirs) mkdirSync(join(art, d), { recursive: true });
  await png(join(art, 'themes/nebula-dusk/background.png'), 1290, 2796);
  await png(join(art, 'themes/nebula-dusk/background-wide.png'), 2560, 1440);
  await png(join(art, 'themes/deep-sea/background.png'), 800, 1200); // wrong size → warning, still built
  await png(join(art, 'card-backs/teal-geometric/back.png'), 750, 1050);
  await png(join(art, 'card-backs/odd-name/My Back Art.png'), 750, 1050); // only image in the folder → used
  // A bright, oddly named JPEG: used as the background and given a darker scrim.
  await sharp({ create: { width: 1290, height: 2796, channels: 3, background: '#eeeeee' } }).jpeg().toFile(join(art, 'themes/photo/some-unsplash-name.jpg'));
  await png(join(art, 'card-faces/partial/S01.png'), 750, 1050); // 1 of 52 → skipped
  const tiny = await sharp({ create: { width: 75, height: 105, channels: 3, background: '#ffffff' } }).png().toBuffer();
  for (const s of ['S', 'H', 'C', 'D']) for (let r = 1; r <= 13; r++) writeFileSync(join(art, `card-faces/full/${s}${String(r).padStart(2, '0')}.png`), tiny);
  // A 100×100 transparent canvas with a 40×60 mark made of two bars (a transparent gap between, like a real logo).
  const bar = { create: { width: 40, height: 25, channels: 4 as const, background: '#cccccc' } };
  await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: bar, left: 30, top: 20 },
      { input: bar, left: 30, top: 55 },
    ])
    .png()
    .toFile(join(art, 'brand/logo-silver.png'));
  await png(join(art, 'icons/icon-1024.png'), 1024, 1024);
  mkdirSync(join(root, 'public'));
  writeFileSync(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350"><rect width="250" height="350" fill="#12c5c8"/></svg>');
  result = await buildAssets({
    artDir: art,
    publicDir: join(root, 'public'),
    manifestPath: join(root, 'generated.ts'),
    iconSource: join(root, 'icon.svg'),
    log: () => undefined,
  });
}, 30_000);

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('npm run assets (TAD §12.5)', () => {
  it('writes optimised WebP files at the target sizes', async () => {
    const bg = await sharp(join(root, 'public/art/themes/nebula-dusk/background.webp')).metadata();
    expect([bg.format, bg.width, bg.height]).toEqual(['webp', SIZES.background.width, SIZES.background.height]);
    const back = await sharp(join(root, 'public/art/card-backs/teal-geometric/back.webp')).metadata();
    expect([back.width, back.height]).toEqual([SIZES.card.width, SIZES.card.height]);
    const touch = await sharp(join(root, 'public/icons/apple-touch-icon.png')).metadata();
    expect([touch.width, touch.height]).toEqual([180, 180]);
    // Full-size copies for the inspect view.
    const backLarge = await sharp(join(root, 'public/art/card-backs/teal-geometric/large/back.webp')).metadata();
    expect([backLarge.width, backLarge.height]).toEqual([SIZES.cardLarge.width, SIZES.cardLarge.height]);
    const faceLarge = await sharp(join(root, 'public/art/card-faces/full/large/H12.webp')).metadata();
    expect([faceLarge.width, faceLarge.height]).toEqual([SIZES.cardLarge.width, SIZES.cardLarge.height]);
    const logo = await sharp(join(root, 'public/art/brand/logo-silver.webp')).metadata();
    expect([logo.format, logo.height, logo.hasAlpha]).toEqual(['webp', SIZES.logoHeight, true]);
  });

  it('lists what it built and warns about wrong sizes and incomplete face sets', () => {
    expect(result.manifest.themes['nebula-dusk']).toEqual({
      background: '/art/themes/nebula-dusk/background.webp',
      backgroundWide: '/art/themes/nebula-dusk/background-wide.webp',
    });
    expect(result.manifest.themes['photo']).toEqual({ background: '/art/themes/photo/background.webp', scrim: 'rgba(0, 0, 0, 0.68)' });
    expect(result.manifest.cardBacks).toEqual({
      'odd-name': '/art/card-backs/odd-name/back.webp',
      'teal-geometric': '/art/card-backs/teal-geometric/back.webp',
    });
    expect(Object.keys(result.manifest.cardFaces)).toEqual(['full']);
    expect(result.manifest.cardFaces['full']!['H12']).toBe('/art/card-faces/full/H12.webp');
    expect(result.manifest.cardFacesLarge['full']!['H12']).toBe('/art/card-faces/full/large/H12.webp');
    expect(result.manifest.cardBacksLarge['teal-geometric']).toBe('/art/card-backs/teal-geometric/large/back.webp');
    expect(result.manifest.brand).toEqual({ silver: { src: '/art/brand/logo-silver.webp', aspect: 0.667 } });
    expect(result.warnings.some((w) => w.includes('deep-sea') && w.includes('800×1200'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('"partial"') && w.includes('51 of 52'))).toBe(true);
    expect(readFileSync(join(root, 'generated.ts'), 'utf8')).toContain('export const GENERATED');
  });

  it('swaps art into existing entries and adds new folders as options', () => {
    // Only the hand-written entries (they come first), so the owner's real art doesn't leak into the test.
    const r = withArt({ themes: THEMES.slice(0, 1), backs: CARD_BACKS.slice(0, 1), faces: [] }, {
      ...result.manifest,
      cardFaces: { classic: { S01: '/x.webp' } },
      cardFacesLarge: { classic: { S01: '/large/x.webp' } },
    });
    expect(r.themes.map((t) => t.name)).toEqual(['Nebula Dusk', 'Deep Sea', 'Photo']);
    expect(r.themes[0]!.background).toBe('url("/art/themes/nebula-dusk/background.webp")');
    expect(r.themes[0]!.backgroundWide).toBe('url("/art/themes/nebula-dusk/background-wide.webp")');
    expect(r.themes[0]!.preview).toBe('center / cover no-repeat url("/art/themes/nebula-dusk/background.webp")');
    expect(r.themes[0]!.scrim).toBe(THEMES[0]!.scrim); // dark art keeps the default scrim
    expect(r.themes[2]!.scrim).toBe('rgba(0, 0, 0, 0.68)');
    expect(r.backs[0]!.src).toBe('/art/card-backs/teal-geometric/back.webp');
    expect(r.backs[0]!.srcLarge).toBe('/art/card-backs/teal-geometric/large/back.webp');
    expect(r.faces[0]).toMatchObject({ id: 'classic', kind: 'images', imagesLarge: { S01: '/large/x.webp' } });
    expect(titleFromId('teal_geometric-v2')).toBe('Teal Geometric V2');
  });
});
