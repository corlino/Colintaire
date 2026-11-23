import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  const dirs = ['themes/nebula-dusk', 'themes/deep-sea', 'card-backs/teal-geometric', 'card-faces/partial'];
  for (const d of dirs) mkdirSync(join(art, d), { recursive: true });
  await png(join(art, 'themes/nebula-dusk/background.png'), 1290, 2796);
  await png(join(art, 'themes/nebula-dusk/background-wide.png'), 2560, 1440);
  await png(join(art, 'themes/deep-sea/background.png'), 800, 1200); // wrong size → warning, still built
  await png(join(art, 'card-backs/teal-geometric/back.png'), 750, 1050);
  await png(join(art, 'card-faces/partial/S01.png'), 750, 1050); // 1 of 52 → skipped
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
    const preview = await sharp(join(root, 'public/art/themes/deep-sea/preview.webp')).metadata();
    expect([preview.width, preview.height]).toEqual([SIZES.preview, SIZES.preview]);
    expect(existsSync(join(root, 'public/icons/apple-touch-icon.png'))).toBe(true);
  });

  it('lists what it built and warns about wrong sizes and incomplete face sets', () => {
    expect(result.manifest.themes['nebula-dusk']).toEqual({
      background: '/art/themes/nebula-dusk/background.webp',
      preview: '/art/themes/nebula-dusk/preview.webp',
      backgroundWide: '/art/themes/nebula-dusk/background-wide.webp',
    });
    expect(result.manifest.cardBacks).toEqual({ 'teal-geometric': '/art/card-backs/teal-geometric/back.webp' });
    expect(result.manifest.cardFaces).toEqual({});
    expect(result.warnings.some((w) => w.includes('deep-sea') && w.includes('800×1200'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('"partial"') && w.includes('51 of 52'))).toBe(true);
    expect(readFileSync(join(root, 'generated.ts'), 'utf8')).toContain('export const GENERATED');
  });

  it('swaps art into existing entries and adds new folders as options', () => {
    const r = withArt({ themes: THEMES, backs: CARD_BACKS, faces: [] }, { ...result.manifest, cardFaces: { classic: { S01: '/x.webp' } } });
    expect(r.themes.map((t) => t.name)).toEqual(['Nebula Dusk', 'Deep Sea']);
    expect(r.themes[0]!.background).toBe('url("/art/themes/nebula-dusk/background.webp")');
    expect(r.themes[0]!.backgroundWide).toBe('url("/art/themes/nebula-dusk/background-wide.webp")');
    expect(r.themes[0]!.scrim).toBe(THEMES[0]!.scrim);
    expect(r.backs[0]!.src).toBe('/art/card-backs/teal-geometric/back.webp');
    expect(r.faces[0]).toMatchObject({ id: 'classic', kind: 'images' });
    expect(titleFromId('teal_geometric-v2')).toBe('Teal Geometric V2');
  });
});
