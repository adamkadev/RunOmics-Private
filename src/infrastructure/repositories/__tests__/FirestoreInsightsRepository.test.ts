import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CachedInsight } from '../FirestoreInsightsRepository'

const { get, set, doc, collectionGet, collection, orderBy, startAt, endAt, select, rangeGet } = vi.hoisted(() => {
  const get = vi.fn()
  const set = vi.fn()
  const collectionGet = vi.fn()
  const rangeGet = vi.fn()
  const doc = vi.fn(() => ({ get, set }))
  const select = vi.fn(() => ({ get: rangeGet }))
  const endAt = vi.fn(() => ({ select }))
  const startAt = vi.fn(() => ({ endAt }))
  const orderBy = vi.fn(() => ({ startAt }))
  return {
    get, set, doc, collectionGet, rangeGet, orderBy, startAt, endAt, select,
    collection: vi.fn(() => ({ doc, orderBy, get: collectionGet })),
  }
})

vi.mock('firebase-admin/firestore', () => ({ FieldPath: { documentId: () => '__name__' } }))
vi.mock('@/lib/firebase-admin', () => ({ getAdminFirestore: () => ({ collection }) }))

const { readVerifiedInsight, saveCachedInsight, listCachedKeys, readVerdictPhrasing, saveVerdictPhrasing } = await import(
  '../FirestoreInsightsRepository'
)

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

describe('listCachedKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rangeGet.mockResolvedValue({ docs: [] })
  })

  function hashDoc(id: string, hash: string, noteKey?: string) {
    return { id, get: (field: string) => (field === 'hash' ? hash : field === 'noteKey' ? noteKey : undefined) }
  }

  it('asks Firestore only for the document-ID range the prefix covers', async () => {
    await listCachedKeys('runVerdict_')

    expect(orderBy).toHaveBeenCalledWith('__name__')
    expect(startAt).toHaveBeenCalledWith('runVerdict_')
    expect(endAt).toHaveBeenCalledWith('runVerdict_\uf8ff')
  })

  it('never falls back to scanning the whole collection', async () => {
    await listCachedKeys('runVerdict_')

    expect(collectionGet).not.toHaveBeenCalled()
  })

  it('reads the hash and note key alone rather than whole documents', async () => {
    await listCachedKeys('runVerdict_')

    expect(select).toHaveBeenCalledWith('hash', 'noteKey')
  })

  it('keys the surfaces of the active locale without their prefix or suffix', async () => {
    rangeGet.mockResolvedValue({
      docs: [
        hashDoc('runVerdict_a_en', 'hash-a', 'note-a'),
        hashDoc('runVerdict_b_en', 'hash-b'),
        hashDoc('runVerdict_a_fr', 'hash-a-fr'),
      ],
    })

    const keys = await listCachedKeys('runVerdict_')

    expect([...keys.keys()]).toEqual(['runVerdict_a', 'runVerdict_b'])
    expect(keys.get('runVerdict_a')).toEqual({ hash: 'hash-a', noteKey: 'note-a' })
    expect(keys.get('runVerdict_b')).toEqual({ hash: 'hash-b' })
  })
})

describe('read amplification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.FIREBASE_PROJECT_ID = 'runomics-test'
    onDisk(stored())
  })

  afterEach(() => {
    delete process.env.FIREBASE_PROJECT_ID
  })

  it('serves one surface with one document read and no collection scan', async () => {
    await readVerifiedInsight('runVerdict_a', 'facts-as-generated')

    expect(doc).toHaveBeenCalledWith('runVerdict_a_en')
    expect(get).toHaveBeenCalledTimes(1)
    expect(collectionGet).not.toHaveBeenCalled()
  })

  it('costs one read per surface asked for, whatever the collection holds', async () => {
    for (const id of ['a', 'b', 'c', 'd']) await readVerifiedInsight(`runVerdict_${id}`, 'facts-as-generated')

    expect(get).toHaveBeenCalledTimes(4)
    expect(collectionGet).not.toHaveBeenCalled()
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

describe('verdict phrasing history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.FIREBASE_PROJECT_ID = 'runomics-test'
  })

  afterEach(() => {
    delete process.env.FIREBASE_PROJECT_ID
  })

  it('keeps one shared document so phrasing carries between activities', async () => {
    await saveVerdictPhrasing([{ headline: 'Faster aerobic engine', body: 'Held drift to 8 bpm.' }])

    expect(doc).toHaveBeenCalledWith('verdictPhrasing_en')
  })

  it('caps what it stores so the avoid clause cannot grow without bound', async () => {
    const many = Array.from({ length: 44 }, (_, i) => ({ headline: `H${i}`, body: `B${i}` }))

    await saveVerdictPhrasing(many)

    expect((set.mock.calls[0]![0] as { recent: unknown[] }).recent).toHaveLength(40)
  })

  it('reads back the kind of session each verdict was written for, and drops a malformed one', async () => {
    const recent = [
      { headline: 'Kept', body: 'b', kind: 'threshold' },
      { headline: 'Dropped', body: 'b', kind: 3 },
    ]
    get.mockResolvedValue({ exists: true, data: () => ({ recent }) })

    expect(await readVerdictPhrasing()).toEqual([{ headline: 'Kept', body: 'b', kind: 'threshold' }])
  })

  it('reads back what a previous invocation wrote', async () => {
    const recent = [{ headline: 'Controlled aerobic building', body: 'Drift held at 8 bpm.' }]
    get.mockResolvedValue({ exists: true, data: () => ({ recent }) })

    expect(await readVerdictPhrasing()).toEqual(recent)
  })

  it('drops entries that are not a headline and body rather than feeding junk to the prompt', async () => {
    get.mockResolvedValue({
      exists: true,
      data: () => ({ recent: [{ headline: 'Real', body: 'Copy.' }, { headline: 'No body' }, null, 'string'] }),
    })

    expect(await readVerdictPhrasing()).toEqual([{ headline: 'Real', body: 'Copy.' }])
  })

  it('starts empty on a first run, a missing field, or a read that throws', async () => {
    get.mockResolvedValue({ exists: false, data: () => undefined })
    expect(await readVerdictPhrasing()).toEqual([])

    get.mockResolvedValue({ exists: true, data: () => ({}) })
    expect(await readVerdictPhrasing()).toEqual([])

    get.mockRejectedValue(new Error('firestore unavailable'))
    expect(await readVerdictPhrasing()).toEqual([])
  })

  it('stays silent when the project is not configured, like every other read here', async () => {
    delete process.env.FIREBASE_PROJECT_ID

    expect(await readVerdictPhrasing()).toEqual([])
    expect(get).not.toHaveBeenCalled()
  })
})

