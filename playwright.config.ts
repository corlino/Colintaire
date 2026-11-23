import { defineConfig, devices } from '@playwright/test';

/** E2E on the TAD §4 device profiles. Uses its own dev server port so it never clashes with `npm run dev`. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure' },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'iPhone 13 mini', use: { ...devices['iPhone 13 Mini'] } },
    { name: 'iPhone 15 Pro Max', use: { ...devices['iPhone 15 Pro Max'] } },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
  ],
});
