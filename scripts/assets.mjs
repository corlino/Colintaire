/**
 * npm run assets — builds optimised app icons in public/icons (TAD §12.5).
 * Source: art/icons/icon-1024.png when the owner has supplied it; otherwise a
 * placeholder made from the Teal Geometric card back centred on #101010.
 * M6 extends this script with backgrounds and card backs.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

const BG = '#101010';
const OUT = 'public/icons';
const SUPPLIED = 'art/icons/icon-1024.png';
mkdirSync(OUT, { recursive: true });

/** A 1024 px square master. `inset` is the share of the canvas the artwork may use. */
async function master(inset) {
  if (existsSync(SUPPLIED)) {
    const size = Math.round(1024 * inset);
    const art = await sharp(SUPPLIED).resize(size, size).toBuffer();
    return sharp({ create: { width: 1024, height: 1024, channels: 3, background: BG } })
      .composite([{ input: art, gravity: 'centre' }])
      .png()
      .toBuffer();
  }
  const h = Math.round(1024 * inset);
  const w = Math.round((h * 5) / 7);
  const card = await sharp(readFileSync('src/assets/placeholders/teal-geometric.svg'), { density: 600 })
    .resize(w, h, { fit: 'fill' })
    .png()
    .toBuffer();
  // Round the card's corners to match the board.
  const r = Math.round(w * 0.08);
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);
  const rounded = await sharp(card).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp({ create: { width: 1024, height: 1024, channels: 3, background: BG } })
    .composite([{ input: rounded, gravity: 'centre' }])
    .png()
    .toBuffer();
}

const standard = await master(0.8);
const maskable = await master(0.6); // Android masks can crop to the central ~80% circle.

const outputs = [
  ['icon-192.png', standard, 192],
  ['icon-512.png', standard, 512],
  ['icon-maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', standard, 180],
  ['favicon-32.png', standard, 32],
];
for (const [name, src, size] of outputs) {
  await sharp(src).resize(size, size).png({ compressionLevel: 9, palette: size <= 192 }).toFile(`${OUT}/${name}`);
  console.log(`${OUT}/${name}`);
}
