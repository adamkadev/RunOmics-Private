import fs from 'node:fs'
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
const DOM_EXTRA = [
  'src/lib/__tests__/accent.test.ts',
  'src/lib/__tests__/fileExport.test.ts',
  'src/lib/__tests__/pushNotifications.test.ts',
  'src/lib/__tests__/pushPrefs.test.ts',
  'src/domain/explore/__tests__/gpx.test.ts',
]
const DOM_TESTS = ['src/**/*.test.tsx', ...DOM_EXTRA]
const isDomTest = (file: string) => file.endsWith('.test.tsx') || DOM_EXTRA.includes(file)

const SHARED_EXCLUDE = ['**/node_modules/**', '**/dist/**', 'e2e/**', 'screenshots/**', '.claude/**']

/**
 * The component files share one jsdom window per worker (`isolate: false`):
 * a fresh window and a fresh React import for every one of them was most of
 * a run, about 60 s of 90. Each still gets its own copy of the app's modules
 * (vitest.fresh-modules.ts), but not of the mocks: a file that swaps a module
 * out with vi.mock or vi.doMock would carry the swap into the files after it,
 * so it gets a window of its own. So does one that calls vi.resetModules: it
 * re-imports under env vars or globals it stubbed, which would carry over
 * just the same. They are found by reading the files, not from a list to keep.
 *
 * The logic files stay isolated: sharing saved them a few seconds, and cost
 * order-dependent failures - a rate limiter's budget, a data workspace -
 * once in a dozen runs.
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

const ISOLATED_DOM = testFiles('src')
  .filter((file) => isDomTest(file) && SWAPS_MODULES.test(fs.readFileSync(file, 'utf8')))
  .map(asGlob)

// Each shared file still gets its own copy of the app's modules: see the file.
const FRESH_MODULES = './vitest.fresh-modules.ts'

const node = { environment: 'node' as const }
const dom = {
  environment: 'jsdom' as const,
  environmentOptions: { jsdom: { url: 'http://localhost' } },
  setupFiles: ['./vitest.setup.ts'],
}
const project = (test: Record<string, unknown>) => ({ plugins: [react()], resolve: { alias }, test })

export default defineConfig({
  test: {
    // Not `forks`: its per-file process spawn is a large share of a run, on Windows especially.
    pool: 'threads',
    projects: [
      project({ ...node, name: 'node', include: ['**/*.test.{ts,mts,js,mjs}'], exclude: [...SHARED_EXCLUDE, ...DOM_TESTS] }),
      project({
        ...dom,
        name: 'dom',
        isolate: false,
        // The reset first, so what vitest.setup.ts loads is what the file uses.
        setupFiles: [FRESH_MODULES, ...dom.setupFiles],
        include: DOM_TESTS,
        exclude: [...SHARED_EXCLUDE, ...ISOLATED_DOM],
      }),
      project({ ...dom, name: 'dom:isolated', include: ISOLATED_DOM, exclude: SHARED_EXCLUDE }),
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
