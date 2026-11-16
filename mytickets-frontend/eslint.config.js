import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Features talk to each other through their index.ts, never by reaching into each other's folders.
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/features/*/*'], message: "Import from the feature's index instead." }] },
      ],
    },
  },
  {
    // Test helpers export render functions and mock data, not components to hot-reload.
    files: ['src/test/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
