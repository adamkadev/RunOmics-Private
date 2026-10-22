import { describe, it, expect, vi } from 'vitest'
import {
  EXPLORE_DB,
  EXPLORE_DB_VERSION,
  NO_CACHE,
  areaCacheKey,
  createIdbCache,
  openExploreDb,
  prefixBounds,
  trackCacheKey,
} from '../idb'

/**
 * A small in-memory IndexedDB: string keys, structured-clone values, requests
 * that succeed on a later microtask and transactions that complete after
 * them, which is all the cache relies on.
 */
interface Range {
  lower: string
  upper: string
}
const isRange = (key: unknown): key is Range => typeof key === 'object' && key !== null && 'lower' in key
const inRange = (key: string, { lower, upper }: Range) => key >= lower && key <= upper

class FakeRequest<T = unknown> {
  result!: T
  error: Error | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  onupgradeneeded: (() => void) | null = null

  succeed(value: T) {
    queueMicrotask(() => {
      this.result = value
      this.onsuccess?.()
    })
    return this
  }
}

class FakeTransaction {
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  error: Error | null = null

  constructor(private data: Map<string, unknown>) {
    setTimeout(() => this.oncomplete?.(), 0)
  }

  objectStore() {
    const data = this.data
    return {
      get: (key: string) => new FakeRequest().succeed(structuredClone(data.get(key))),
      put: (value: unknown, key: string) => {
        data.set(key, structuredClone(value))
        return new FakeRequest().succeed(key)
      },
      delete: (key: string | Range) => {
        for (const k of [...data.keys()]) if (isRange(key) ? inRange(k, key) : k === key) data.delete(k)
        return new FakeRequest().succeed(undefined)
      },
      getAllKeys: (range: Range) => new FakeRequest().succeed([...data.keys()].filter((k) => inRange(k, range)).sort()),
    }
  }
}

class FakeDb {
  stores = new Map<string, Map<string, unknown>>()
  version = 0
  onversionchange: (() => void) | null = null
  objectStoreNames = { contains: (name: string) => this.stores.has(name) }

  createObjectStore(name: string) {
    this.stores.set(name, new Map())
  }

  transaction(name: string) {
    const data = this.stores.get(name)
    if (!data) throw new Error(`NotFoundError: ${name}`)
    return new FakeTransaction(data)
  }

  close() {}
}

class FakeFactory {
  db = new FakeDb()
  open = vi.fn((name: string, version: number) => {
    expect(name).toBe(EXPLORE_DB)
    const request = new FakeRequest<FakeDb>()
    queueMicrotask(() => {
      request.result = this.db
      if (version > this.db.version) {
        this.db.version = version
        request.onupgradeneeded?.()
      }
      request.onsuccess?.()
    })
    return request
  })
}

const keyRange = { bound: (lower: string, upper: string) => ({ lower, upper }) as unknown as IDBKeyRange }

function cache(factory = new FakeFactory()) {
  return { factory, cache: createIdbCache(factory as unknown as IDBFactory, keyRange) }
}

describe('cache keys', () => {
  it('names areas by id and version, runs by area version and activity', () => {
    expect(areaCacheKey('metz', 'metz-20261022-0123abcd')).toBe('metz:metz-20261022-0123abcd')
    expect(trackCacheKey('metz-20261022-0123abcd', '17012345678')).toBe('metz-20261022-0123abcd:17012345678')
  })

  it('bounds a prefix so that only keys starting with it fall inside', () => {
    const [lower, upper] = prefixBounds('metz:')
    const inside = (key: string) => key >= lower && key <= upper

    expect(inside('metz:metz-1')).toBe(true)
    expect(inside('metz:')).toBe(true)
    expect(inside('metz-nord:x')).toBe(false)
    expect(inside('metzz:x')).toBe(false)
  })
})

describe('openExploreDb', () => {
  it('creates both stores on first open', async () => {
    const factory = new FakeFactory()

    expect(await openExploreDb(factory as unknown as IDBFactory)).toBe(factory.db)
    expect(factory.open).toHaveBeenCalledWith(EXPLORE_DB, EXPLORE_DB_VERSION)
    expect([...factory.db.stores.keys()]).toEqual(['areas', 'tracks'])
  })

  it('is null without IndexedDB, or when opening throws or fails', async () => {
    const throwing = { open: () => { throw new Error('SecurityError') } }
    const failing = {
      open: () => {
        const request = new FakeRequest()
        queueMicrotask(() => {
          request.error = new Error('InvalidStateError')
          request.onerror?.()
        })
        return request
      },
    }

    expect(await openExploreDb(undefined)).toBeNull()
    expect(await openExploreDb(throwing as unknown as IDBFactory)).toBeNull()
    expect(await openExploreDb(failing as unknown as IDBFactory)).toBeNull()
  })
})

describe('createIdbCache', () => {
  it('stores and reads values', async () => {
    const { cache: c } = cache()
    const value = { cells: new Uint32Array([1, 2]), metresByUnit: new Float64Array([0.5]) }

    await c.put('tracks', 'v1:a', value)

    expect(await c.get('tracks', 'v1:a')).toEqual(value)
    expect(await c.get('tracks', 'v1:b')).toBeUndefined()
    expect(await c.get('areas', 'v1:a')).toBeUndefined()
  })

  it('reads and writes many at once, misses in place', async () => {
    const { cache: c } = cache()

    await c.putMany('tracks', [
      ['v1:a', 1],
      ['v1:c', 3],
    ])

    expect(await c.getMany('tracks', ['v1:a', 'v1:b', 'v1:c'])).toEqual([1, undefined, 3])
    expect(await c.getMany('tracks', [])).toEqual([])
  })

  it('lists and deletes by prefix', async () => {
    const { cache: c } = cache()
    await c.putMany('areas', [
      ['metz:metz-1', 1],
      ['metz:metz-2', 2],
      ['metz-nord:metz-nord-1', 3],
    ])

    expect(await c.keys('areas', 'metz:')).toEqual(['metz:metz-1', 'metz:metz-2'])

    await c.deletePrefix('areas', 'metz:')
    expect(await c.keys('areas', 'metz')).toEqual(['metz-nord:metz-nord-1'])

    await c.delete('areas', 'metz-nord:metz-nord-1')
    expect(await c.keys('areas', '')).toEqual([])
  })

  it('opens the database once', async () => {
    const { cache: c, factory } = cache()

    await Promise.all([c.get('areas', 'a'), c.put('areas', 'b', 1), c.keys('tracks', '')])

    expect(factory.open).toHaveBeenCalledTimes(1)
  })

  it('misses instead of failing when a request throws', async () => {
    const { cache: c, factory } = cache()
    await c.put('areas', 'a', 1)
    factory.db.transaction = () => {
      throw new Error('TransactionInactiveError')
    }

    expect(await c.get('areas', 'a')).toBeUndefined()
    expect(await c.getMany('areas', ['a'])).toEqual([undefined])
    expect(await c.keys('areas', '')).toEqual([])
    await expect(c.put('areas', 'b', 2)).resolves.toBeUndefined()
  })

  it('is a no-op without IndexedDB', async () => {
    const c = createIdbCache(undefined)

    await c.put('areas', 'a', 1)
    expect(await c.get('areas', 'a')).toBeUndefined()
    expect(await c.getMany('areas', ['a', 'b'])).toEqual([undefined, undefined])
    expect(await c.keys('areas', '')).toEqual([])
    expect(await NO_CACHE.getMany('tracks', ['x'])).toEqual([undefined])
  })
})
