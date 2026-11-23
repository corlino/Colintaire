import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: { ...globals.node } } },
  // Layer rule (TAD §6): the engine is pure — no React, DOM, layout, store or assets.
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*', 'motion', 'motion/*', 'zustand', 'zustand/*'], message: 'src/engine must stay framework-free.' },
            { group: ['**/layout/**', '**/store/**', '**/ui/**', '**/assets/**'], message: 'src/engine may not import from higher layers.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/layout/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['react', 'react-dom', '**/store/**', '**/ui/**'], message: 'src/layout is pure.' }] }],
    },
  },
);
