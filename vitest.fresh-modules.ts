import { vi } from 'vitest'

/**
 * Run before every file of the shared component project (vitest.config.ts): files
 * there share a worker's environment, but each gets its own copy of the app's
 * modules. Module state - internalAuth's per-IP request budget, a cache, a
 * memoised read - would otherwise carry from one file into the next and fail
 * whichever file the worker happened to run after it. Dependencies loaded
 * from node_modules stay loaded, which is most of what sharing saves.
 */
vi.resetModules()
