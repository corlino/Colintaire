/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
let sha = 'dev';
try {
  sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  /* not a git checkout */
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(`v${pkg.version} · ${sha}`) },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: { include: ['src/engine/**'], provider: 'v8' },
  },
});
