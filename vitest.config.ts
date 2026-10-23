import fs from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const alias = {
  '@': path.resolve(__dirname, './src'),
  'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
}

/**
 * Building a jsdom window costs far more than most of these tests do, and only
 * the component tests need one. Splitting the suite in two lets the pure logic
 * files run in a bare node environment.
 *
 * The rule is the extension: a `.tsx` test renders something, so it gets a DOM.
 * A `.ts` test that reaches for `document`, `localStorage` or `navigator` has
 * to be listed here by hand - the alternative is giving every file a window on
 * the chance a couple of them want one. A missing entry fails loudly (the
 * global is simply undefined), so it is a two-second fix, not a silent one.
 */
const DOM_EXTRA = ['src/lib/__tests__/accent.test.ts', 'src/lib/__tests__/fileExport.test.ts']
const DOM_TESTS = ['src/**/*.test.tsx', ...DOM_EXTRA]
const isDomTest = (file: string) => file.endsWith('.test.tsx') || DOM_EXTRA.includes(file)

const SHARED_EXCLUDE = ['**/node_modules/**', '**/dist/**', 'e2e/**', 'screenshots/**', '.claude/**']

/**
 * Most files share one environment and module registry per worker
 * (`isolate: false`): a fresh jsdom window and a fresh React import for every
 * file was two thirds of a run, about 90 s of it. A file that swaps a module
 * out - vi.mock, vi.doMock, vi.resetModules - would carry that swap into the
 * files after it in the same worker, so those still get a registry of their
 * own. They are found by reading the files, not from a list to keep.
 */
const SWAPS_MODULES = /\bvi\.(mock|doMock|unmock|doUnmock|resetModules)\(/

function testFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : testFiles(file)
    return /\.test\.(ts|tsx|mts|js|mjs)$/.test(entry.name) ? [file] : []
  })
}

// A route test lives under `[id]/`: as a glob, the brackets would be a
// character class.
const asGlob = (file: string) => file.replace(/[[\](){}*?!]/g, '\\$&')

const ISOLATED = ['src', 'scripts']
  .flatMap(testFiles)
  .filter((file) => SWAPS_MODULES.test(fs.readFileSync(file, 'utf8')))
const ISOLATED_NODE = ISOLATED.filter((file) => !isDomTest(file)).map(asGlob)
const ISOLATED_DOM = ISOLATED.filter(isDomTest).map(asGlob)

const node = { environment: 'node' as const }
const dom = {
  environment: 'jsdom' as const,
  environmentOptions: { jsdom: { url: 'http://localhost' } },
  setupFiles: ['./vitest.setup.ts'],
}
const project = (test: Record<string, unknown>) => ({ plugins: [react()], resolve: { alias }, test })

export default defineConfig({
  test: {
    // Worker threads rather than child processes: on Windows especially, the
    // per-file process spawn that `forks` pays is a large share of a run.
    pool: 'threads',
    projects: [
      project({
        ...node,
        name: 'node',
        isolate: false,
        include: ['**/*.test.{ts,mts,js,mjs}'],
        exclude: [...SHARED_EXCLUDE, ...DOM_TESTS, ...ISOLATED_NODE],
      }),
      project({ ...node, name: 'node:isolated', include: ISOLATED_NODE, exclude: SHARED_EXCLUDE }),
      project({ ...dom, name: 'dom', isolate: false, include: DOM_TESTS, exclude: [...SHARED_EXCLUDE, ...ISOLATED_DOM] }),
      project({ ...dom, name: 'dom:isolated', include: ISOLATED_DOM, exclude: SHARED_EXCLUDE }),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // All of src, the routes and adapters included. CI's weekly run reports
      // the totals, with no threshold yet (.github/workflows/ci.yml).
      include: ['src/**/*.{ts,tsx}'],
      // Test helpers, and the locale tables, which are data.
      exclude: ['src/**/__tests__/**', 'src/i18n/{en,fr}.ts'],
    },
  },
})
