import { expect, test, type Page } from '@playwright/test';
import type { Card, GameState, PileRef } from '../src/engine/types';

// ---------------------------------------------------------------- helpers

const getState = (page: Page) => page.evaluate(() => window.__colintaire!.getState());

async function loadBoard(page: Page, board: Partial<GameState['board']>, extra: Partial<GameState> = {}) {
  await page.evaluate(
    ([b, e]) => {
      const g = window.__colintaire!.getState();
      window.__colintaire!.loadGame({
        ...g,
        mode: 'classic',
        status: 'playing',
        moves: 0,
        classic: { points: 0, undoPenalty: 0 },
        vegas: { credited: [], everPaid: [] },
        undo: { used: 0, history: [] },
        ...e,
        board: { stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []], ...b },
      });
    },
    [board, extra] as const,
  );
  await page.waitForTimeout(1000); // deal animation
}

const card = (id: string, faceUp = true): Card => ({ id, suit: id[0] as Card['suit'], rank: Number(id.slice(1)) as Card['rank'], faceUp });
const run = (a: string, b: string): Card[] =>
  Array.from({ length: 13 }, (_, i) => card(`${i % 2 === 0 ? a : b}${String(13 - i).padStart(2, '0')}`));

async function centre(page: Page, id: string, dy = 0.5) {
  const box = (await page.locator(`[data-card="${id}"]`).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height * dy };
}

/** A pointer drag with intermediate moves, as a finger would produce. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
  await page.mouse.up();
  await page.waitForTimeout(350);
}

const pile = (s: GameState, ref: PileRef) =>
  ref.kind === 'tableau' ? s.board.tableau[ref.index]! : ref.kind === 'foundation' ? s.board.foundations[ref.index]! : s.board[ref.kind];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__colintaire);
});

// ---------------------------------------------------------------- specs

test('drags a card from a reversed bottom stack onto a top stack (AC 4–5)', async ({ page }) => {
  await page.evaluate(() => window.__colintaire!.newGame({ seed: 7 }));
  await page.waitForTimeout(1000);
  const s0 = await getState(page);
  expect(s0.board.tableau[5]!.at(-1)!.id).toBe('H02');
  expect(s0.board.tableau[2]!.at(-1)!.id).toBe('S03');

  const target = await centre(page, 'S03', 0.6);
  await drag(page, await centre(page, 'H02', 0.2), target);

  const s1 = await getState(page);
  expect(s1.board.tableau[2]!.map((c) => c.id).slice(-2)).toEqual(['S03', 'H02']);
  expect(s1.board.tableau[5]!.at(-1)!.faceUp).toBe(true); // auto-flip
  await expect(page.getByRole('group', { name: 'Moves 1' })).toBeVisible();
});

test('springs back an illegal drop and changes nothing (AC 6)', async ({ page }) => {
  await loadBoard(page, { tableau: [[card('H11')], [], [], [], [card('C13')], [], []] });
  const before = await getState(page);
  await drag(page, await centre(page, 'H11'), await centre(page, 'C13', 0.6));
  const after = await getState(page);
  expect(after.board).toEqual(before.board);
  expect(after.moves).toBe(0);
});

test('tap selects, tap on a pile moves; double-tap sends to the foundation (U9)', async ({ page }) => {
  await loadBoard(page, { tableau: [[card('S09')], [card('H08')], [], [], [], [card('S01')], []] });
  await page.mouse.click(...Object.values(await centre(page, 'H08')) as [number, number]);
  await page.waitForTimeout(150);
  await page.mouse.click(...Object.values(await centre(page, 'S09')) as [number, number]);
  await page.waitForTimeout(350);
  let s = await getState(page);
  expect(s.board.tableau[0]!.map((c) => c.id)).toEqual(['S09', 'H08']);

  const ace = await centre(page, 'S01');
  await page.mouse.dblclick(ace.x, ace.y);
  await page.waitForTimeout(350);
  s = await getState(page);
  expect(s.board.foundations[0]!.map((c) => c.id)).toEqual(['S01']);
});

test('stock deals one card per tap and recycles in the same order (AC 8–10)', async ({ page }) => {
  const stock = ['S05', 'H07', 'C09'].map((id) => card(id, false));
  await loadBoard(page, { stock, tableau: [[card('S13')], [card('H13')], [card('C13')], [card('D13')], [], [], []] });
  const stockEl = page.getByTestId('stock');
  const box = (await stockEl.boundingBox())!;
  const tap = () => page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const order: string[] = [];
  for (let i = 0; i < 3; i++) {
    await tap();
    await page.waitForTimeout(220);
    order.push((await getState(page)).board.waste.at(-1)!.id);
  }
  expect(order).toEqual(['C09', 'H07', 'S05']);
  await tap(); // recycle
  await page.waitForTimeout(220);
  expect((await getState(page)).board.stock).toHaveLength(3);
  await tap();
  await page.waitForTimeout(220);
  expect((await getState(page)).board.waste.at(-1)!.id).toBe('C09');
});

test('peek opens a folded column and picks from the middle of the run (U19)', async ({ page }) => {
  await loadBoard(page, { tableau: [run('S', 'H'), [], [card('D10')], [], [], run('H', 'S'), []] });
  // Pile 1 holds the S/H run and pile 6 the H/S run, so ids never collide.
  const bundle = page.locator('[data-bundle="0"]');
  test.skip((await bundle.count()) === 0, 'No folding at this screen height');
  await bundle.click();
  const peek = page.getByTestId('peek');
  await expect(peek).toBeVisible();
  // Tap the card's visible strip, as a finger would; the next card covers the rest.
  await peek.getByRole('button', { name: '9 of spades' }).click({ position: { x: 12, y: 6 } });
  await expect(peek).toBeHidden();
  const dest = await centre(page, 'D10');
  await page.mouse.click(dest.x, dest.y);
  await page.waitForTimeout(350);
  const s = await getState(page);
  expect(pile(s, { kind: 'tableau', index: 2 }).map((c) => c.id)).toEqual(['D10', 'S09', 'H08', 'S07', 'H06', 'S05', 'H04', 'S03', 'H02', 'S01']);
});

test('New Game pauses the timer, and Vegas starts at −$52 (PRD 6.3, Style Guide 9.1)', async ({ page }) => {
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Solitaire/ }).click();
  const dialog = page.getByRole('dialog', { name: 'New Game' });
  await expect(dialog).toBeVisible();
  const time = page.getByRole('group', { name: /^Time / });
  const t1 = await time.getAttribute('aria-label');
  await page.waitForTimeout(1500);
  expect(await time.getAttribute('aria-label')).toBe(t1);

  await dialog.getByRole('radio', { name: 'Vegas' }).click();
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('group', { name: 'Score −$52' })).toBeVisible();
});

test('closing New Game without confirming leaves the game unchanged (PRD 6.3)', async ({ page }) => {
  const before = await getState(page);
  await page.getByRole('button', { name: /Solitaire/ }).click();
  await page.getByRole('dialog', { name: 'New Game' }).getByRole('radio', { name: 'Vegas' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await getState(page)).toEqual(before);
});

test('playing the last cards wins and shows the final stats (AC 11)', async ({ page }) => {
  const suits = ['S', 'H', 'C', 'D'] as const;
  const foundations = suits.map((s) => Array.from({ length: 12 }, (_, i) => card(`${s}${String(i + 1).padStart(2, '0')}`))) as unknown as GameState['board']['foundations'];
  await loadBoard(page, { foundations, tableau: [[card('S13')], [card('H13')], [card('C13')], [], [], [card('D13')], []] }, { mode: 'vegas' });
  for (const id of ['S13', 'H13', 'C13', 'D13']) {
    const c = await centre(page, id);
    await page.mouse.dblclick(c.x, c.y);
    await page.waitForTimeout(300);
  }
  const dialog = page.getByRole('dialog', { name: 'You Won' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('This game')).toBeVisible();
  await dialog.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByRole('dialog', { name: 'New Game' })).toBeVisible();
});

test('Appearance opens over the game and closes without changing it (AC 27)', async ({ page }) => {
  const before = await getState(page);
  await page.getByRole('button', { name: 'Appearance' }).click();
  const dialog = page.getByRole('dialog', { name: 'Appearance' });
  await expect(dialog.getByRole('radio', { name: 'Nebula Dusk' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('radio', { name: 'Teal Geometric' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await getState(page)).toEqual(before);
});
