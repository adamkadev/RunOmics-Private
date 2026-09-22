import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const alias = {
  '@': path.resolve(__dirname, './src'),
  'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
}

/**
 * Building a jsdom window costs far more than most of these tests do, and only
 * the component tests need one. Splitting the suite in two lets the ~165 pure
 * logic files run in a bare node environment, which is most of why a full run
 * takes about a minute rather than three.
 *
 * The rule is the extension: a `.tsx` test renders something, so it gets a DOM.
 * A `.ts` test that reaches for `document`, `localStorage` or `navigator` has
 * to be listed here by hand - the alternative is giving all 198 files a window
 * on the chance a couple of them want one. A missing entry fails loudly (the
 * global is simply undefined), so it is a two-second fix, not a silent one.
 */
const DOM_TESTS = [
  'src/**/*.test.tsx',
  'src/lib/__tests__/accent.test.ts',
  'src/lib/__tests__/fileExport.test.ts',
]

const SHARED_EXCLUDE = ['**/node_modules/**', '**/dist/**', 'e2e/**', 'screenshots/**', '.claude/**']

export default defineConfig({
  test: {
    // Worker threads rather than child processes: on Windows especially, the
    // per-file process spawn that `forks` pays is a large share of a run.
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
      include: ['src/{lib,application,domain,components}/**/*.{ts,tsx}'],
    },
  },
})
