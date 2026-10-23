import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const alias = {
  '@': path.resolve(__dirname, './src'),
  'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
}

/**
 * A jsdom window costs more than most tests do, so only these get one: a `.ts`
 * test that reaches for `document`, `localStorage` or `navigator` is listed by hand.
 */
const DOM_TESTS = [
  'src/**/*.test.tsx',
  'src/lib/__tests__/accent.test.ts',
  'src/lib/__tests__/fileExport.test.ts',
  'src/domain/explore/__tests__/gpx.test.ts',
]

const SHARED_EXCLUDE = ['**/node_modules/**', '**/dist/**', 'e2e/**', 'screenshots/**', '.claude/**']

export default defineConfig({
  test: {
    // Not `forks`: its per-file process spawn is a large share of a run, on Windows especially.
    pool: 'threads',
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.test.{ts,mts,js,mjs}'],
          exclude: [...SHARED_EXCLUDE, ...DOM_TESTS],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'dom',
          environment: 'jsdom',
          environmentOptions: { jsdom: { url: 'http://localhost' } },
          setupFiles: ['./vitest.setup.ts'],
          include: DOM_TESTS,
          exclude: SHARED_EXCLUDE,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // The locale tables are data.
      exclude: ['src/**/__tests__/**', 'src/i18n/{en,fr}.ts'],
    },
  },
})
