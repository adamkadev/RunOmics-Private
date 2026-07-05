import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost' },
    },
    setupFiles: ['./vitest.setup.ts'],
    // e2e/*.spec.ts are Playwright tests (own runner, own `test`/`expect`) -
    // Vitest's default include pattern would otherwise pick them up too.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Pure logic and tested UI only - app router pages/layouts are
      // exercised by the build, not by unit tests.
      include: ['src/lib/**', 'src/application/**', 'src/domain/**', 'src/components/**'],
    },
  },
})
