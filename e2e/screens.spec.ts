import { expect, test } from '@playwright/test';

/**
 * Screenshot baselines of the three reference screens (TAD §16.1). These guard
 * against visual regressions; update deliberately with `npm run e2e -- --update-snapshots`.
 * Baselines are per platform, so CI on Linux keeps its own set.
 */
test.describe('reference screens', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'iPhone 13 mini', 'Baselines are kept for one device');
    await page.clock.setFixedTime(new Date('2026-01-01T10:30:00Z')); // timer stays at 0:00
    await page.goto('/');
    await page.waitForFunction(() => !!window.__colintaire);
    await page.evaluate(() => window.__colintaire!.newGame({ seed: 11 }));
    await page.waitForTimeout(1500); // deal animation
  });

  test('game screen', async ({ page }) => {
    await expect(page).toHaveScreenshot('game.png', { maxDiffPixelRatio: 0.01 });
  });

  test('Appearance modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Appearance' }).click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('appearance.png', { maxDiffPixelRatio: 0.01, mask: [page.getByTestId('app-version')] }); // version changes every commit
  });

  test('New Game modal', async ({ page }) => {
    await page.getByRole('button', { name: /Colintaire/ }).click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('new-game.png', { maxDiffPixelRatio: 0.01 });
  });
});
