import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CachedInsight } from '../FirestoreInsightsRepository'

const { get, set, collection } = vi.hoisted(() => {
  const get = vi.fn()
  const set = vi.fn()
  const doc = vi.fn(() => ({ get, set }))
  const select = vi.fn(() => ({ get: vi.fn() }))
  return { get, set, collection: vi.fn(() => ({ doc, select })) }
})

vi.mock('@/lib/firebase-admin', () => ({ getAdminFirestore: () => ({ collection }) }))

const { readVerifiedInsight, saveCachedInsight } = await import('../FirestoreInsightsRepository')

const NOW = new Date('2026-08-02T09:00:00Z')
const HOURS = 60 * 60 * 1000

function stored(overrides: Partial<CachedInsight> = {}): CachedInsight {
  return {
    headline: 'Jambes fraiches',
    body: 'La semaine est legere, le tempo peut etre honnete.',
    hash: 'facts-as-generated',
    generatedAt: new Date(NOW.getTime() - 6 * HOURS).toISOString(),
    ...overrides,
  }
}

function onDisk(cached: CachedInsight | null) {
  get.mockResolvedValue({ exists: cached !== null, data: () => cached })
}

describe('readVerifiedInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    process.env.FIREBASE_PROJECT_ID = 'runomics-test'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.FIREBASE_PROJECT_ID
  })

  it('serves copy written from exactly the facts the caller holds', async () => {
    onDisk(stored())

    expect(await readVerifiedInsight('todayHero', 'facts-as-generated')).toEqual({
      headline: 'Jambes fraiches',
      body: 'La semaine est legere, le tempo peut etre honnete.',
      bullets: undefined,
    })
  })

  it('nothing at all when there is nothing stored', async () => {
    onDisk(null)

    expect(await readVerifiedInsight('todayHero', 'facts-as-generated')).toBeNull()
  })

  it('nothing without admin credentials, so local dev and the e2e build fall back quietly', async () => {
    delete process.env.FIREBASE_PROJECT_ID
    onDisk(stored())

    expect(await readVerifiedInsight('todayHero', 'facts-as-generated')).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  // The whole point of the grace window: these hashes move at midnight on their
  // own, and a generation pass that fails used to blank the surface all day.
  it('still serves copy whose facts have moved, while it is recent', async () => {
    onDisk(stored({ generatedAt: new Date(NOW.getTime() - 30 * HOURS).toISOString() }))

    expect(await readVerifiedInsight('analyticsTab_performance', 'facts-as-of-today')).not.toBeNull()
  })

  it('stops serving it once it is older than the grace window', async () => {
    onDisk(stored({ generatedAt: new Date(NOW.getTime() - 49 * HOURS).toISOString() }))

    expect(await readVerifiedInsight('analyticsTab_performance', 'facts-as-of-today')).toBeNull()
  })

  it('serves stale copy while its guard holds', async () => {
    onDisk(stored({ guard: 'tone-go' }))

    expect(await readVerifiedInsight('todayHero', { hash: 'facts-as-of-today', guard: 'tone-go' })).not.toBeNull()
  })

  it('drops stale copy the moment its guard moves, whatever its age', async () => {
    onDisk(stored({ guard: 'tone-go' }))

    expect(await readVerifiedInsight('todayHero', { hash: 'facts-as-of-today', guard: 'tone-hold' })).toBeNull()
  })

  // An exact hash match is the copy the caller asked for; nothing about it can
  // be out of step with what is rendered beside it.
  it('serves an exact match even when the guard has moved under it', async () => {
    onDisk(stored({ guard: 'tone-go' }))

    expect(await readVerifiedInsight('todayHero', { hash: 'facts-as-generated', guard: 'tone-hold' })).not.toBeNull()
  })

  it('will not serve stale copy stored before the surface had a guard to check', async () => {
    onDisk(stored())

    expect(await readVerifiedInsight('todayHero', { hash: 'facts-as-of-today', guard: 'tone-go' })).toBeNull()
  })

  it('falls back quietly when Firestore throws', async () => {
    get.mockRejectedValue(new Error('unreachable'))

    expect(await readVerifiedInsight('todayHero', 'facts-as-generated')).toBeNull()
  })
})

describe('saveCachedInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.FIREBASE_PROJECT_ID = 'runomics-test'
  })

  afterEach(() => {
    delete process.env.FIREBASE_PROJECT_ID
  })

  const insight = { headline: 'Jambes fraiches', body: 'Le tempo peut etre honnete.' }

  it('stores the guard so a later read can check it', async () => {
    await saveCachedInsight('todayHero', insight, 'facts', null, 'tone-go')

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ hash: 'facts', guard: 'tone-go' }))
  })

  // Firestore rejects an undefined field outright.
  it('leaves the field out entirely for a surface with no guard', async () => {
    await saveCachedInsight('analyticsTab_volume', insight, 'facts', null)

    expect(Object.keys(set.mock.calls[0]![0] as object)).not.toContain('guard')
  })

  it('carries the headlines forward so the next prompt can avoid repeating them', async () => {
    await saveCachedInsight('todayHero', insight, 'facts', {
      ...insight,
      hash: 'older',
      generatedAt: '2026-08-01T02:45:00.000Z',
      recentHeadlines: ['Une semaine legere'],
    })

    expect(set.mock.calls[0]![0]).toMatchObject({
      recentHeadlines: ['Jambes fraiches', 'Une semaine legere'],
    })
  })
})
