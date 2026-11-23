/**
 * Seeded PRNG (TAD D9). The same seed always produces the same deal, which is
 * what makes Classic restart (FR-19) and reproducible tests possible.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place Fisher–Yates shuffle driven by the given random source. */
export function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
  return items;
}

/** A fresh random 32-bit seed. Lives in the engine as a pure helper; callers supply it to newGame. */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] ?? 0;
}
