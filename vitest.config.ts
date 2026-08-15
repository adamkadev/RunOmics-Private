import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' throws unless it is resolved through a react-server
      // bundle - which is the point in the app, and useless here: the modules
      // marked with it are exactly the ones these tests exercise directly.
      'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost' },
    },
    setupFiles: ['./vitest.setup.ts'],
    // e2e and screenshots specs are Playwright tests (own runner, own `test`/`expect`) -
    // Vitest's default include pattern would otherwise pick them up too.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'screenshots/**', '.claude/**',],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Pure logic and tested UI only - app router pages/layouts are
      // exercised by the build, not by unit tests.
      include: ['src/{lib,application,domain,components}/**/*.{ts,tsx}'],
    },
  },
})
