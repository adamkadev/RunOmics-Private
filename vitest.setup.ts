import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest globals are disabled, so react-testing-library cannot register its
// automatic afterEach cleanup - do it explicitly or renders leak across tests.
afterEach(cleanup)

// Node's built-in `localStorage` global (stable since Node 22) shadows jsdom's
// implementation: vitest only overrides globals it doesn't find already present on
// `global`, so `window.localStorage` resolves back to Node's broken stub too. Pull the
// real Storage instance off the underlying JSDOM instance vitest exposes as `jsdom`.
Object.defineProperty(globalThis, 'localStorage', {
  value: (globalThis as unknown as { jsdom: { window: { localStorage: Storage } } }).jsdom.window
    .localStorage,
  configurable: true,
})

// jsdom doesn't implement matchMedia - stub it so code reading prefers-color-scheme
// (e.g. persistAccent) doesn't throw in tests.
Object.defineProperty(window, 'matchMedia', {
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
  configurable: true,
})
