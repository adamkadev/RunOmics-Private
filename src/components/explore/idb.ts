/**
 * IndexedDB rather than Cache Storage: the service worker deletes every cache it does not own on each
 * release, and Settings › Clear offline cache deletes them all. Without IndexedDB (private browsing,
 * a full disk) the cache is a no-op, never an error the page has to handle.
 */

export const EXPLORE_DB = 'runomics-explore'
export const EXPLORE_DB_VERSION = 1

/** `areas`: area files by `${id}:${version}`. `tracks`: cell results by `${areaVersion}:${activityId}`. */
export type ExploreStore = 'areas' | 'tracks'
export const EXPLORE_STORES: readonly ExploreStore[] = ['areas', 'tracks']

export function areaCacheKey(id: string, version: string): string {
  return `${id}:${version}`
}

/** An area version already names its area (`<id>-<date>-<hash>`), so it alone scopes a run's result. */
export function trackCacheKey(areaVersion: string, activityId: string): string {
  return `${areaVersion}:${activityId}`
}

/** The upper bound is the last BMP code point, which sorts after anything a key holds. */
export function prefixBounds(prefix: string): [string, string] {
  return [prefix, `${prefix}￿`]
}

/** None of these ever rejects. */
export interface ExploreCache {
  get(store: ExploreStore, key: string): Promise<unknown>
  /** `undefined` for a miss, in the order asked. */
  getMany(store: ExploreStore, keys: readonly string[]): Promise<unknown[]>
  put(store: ExploreStore, key: string, value: unknown): Promise<void>
  putMany(store: ExploreStore, entries: readonly (readonly [string, unknown])[]): Promise<void>
  keys(store: ExploreStore, prefix: string): Promise<string[]>
  delete(store: ExploreStore, key: string): Promise<void>
  deletePrefix(store: ExploreStore, prefix: string): Promise<void>
}

export const NO_CACHE: ExploreCache = {
  get: async () => undefined,
  getMany: async (_, keys) => keys.map(() => undefined),
  put: async () => {},
  putMany: async () => {},
  keys: async () => [],
  delete: async () => {},
  deletePrefix: async () => {},
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/** A write transaction commits later than its last request succeeds. */
export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export async function openExploreDb(factory: IDBFactory | undefined): Promise<IDBDatabase | null> {
  if (!factory) return null
  try {
    const request = factory.open(EXPLORE_DB, EXPLORE_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const store of EXPLORE_STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store)
      }
    }
    const db = await requestResult(request)
    // A later version opened in another tab must not wait on this one.
    db.onversionchange = () => db.close()
    return db
  } catch {
    return null
  }
}

/** `keyRange` is passed in so tests can stand in a fake. */
export function createIdbCache(
  factory: IDBFactory | undefined,
  keyRange: Pick<typeof IDBKeyRange, 'bound'> | undefined = globalThis.IDBKeyRange,
): ExploreCache {
  let opened: Promise<IDBDatabase | null> | null = null
  const db = () => (opened ??= openExploreDb(factory))

  async function attempt<T>(fallback: T, work: (db: IDBDatabase) => Promise<T>): Promise<T> {
    try {
      const handle = await db()
      return handle ? await work(handle) : fallback
    } catch {
      return fallback
    }
  }

  function range(prefix: string): IDBKeyRange {
    if (!keyRange) throw new Error('IDBKeyRange unavailable')
    const [lower, upper] = prefixBounds(prefix)
    return keyRange.bound(lower, upper)
  }

  async function write(handle: IDBDatabase, store: ExploreStore, act: (s: IDBObjectStore) => void): Promise<void> {
    const tx = handle.transaction(store, 'readwrite')
    const done = transactionDone(tx)
    try {
      act(tx.objectStore(store))
    } catch (err) {
      // The transaction still settles; nobody is left to hear it, so keep it from going unhandled.
      done.catch(() => {})
      throw err
    }
    await done
  }

  return {
    get: (store, key) =>
      attempt<unknown>(undefined, (h) => requestResult(h.transaction(store, 'readonly').objectStore(store).get(key))),

    getMany: (store, keys) =>
      attempt<unknown[]>(
        keys.map(() => undefined),
        (h) => {
          if (keys.length === 0) return Promise.resolve([])
          const s = h.transaction(store, 'readonly').objectStore(store)
          return Promise.all(keys.map((key) => requestResult(s.get(key))))
        },
      ),

    put: (store, key, value) => attempt(undefined, (h) => write(h, store, (s) => void s.put(value, key))),

    putMany: (store, entries) =>
      attempt(undefined, async (h) => {
        if (entries.length === 0) return
        await write(h, store, (s) => {
          for (const [key, value] of entries) s.put(value, key)
        })
      }),

    keys: (store, prefix) =>
      attempt<string[]>([], async (h) => {
        const keys = await requestResult(h.transaction(store, 'readonly').objectStore(store).getAllKeys(range(prefix)))
        return keys.filter((k): k is string => typeof k === 'string')
      }),

    delete: (store, key) => attempt(undefined, (h) => write(h, store, (s) => void s.delete(key))),

    deletePrefix: (store, prefix) =>
      attempt(undefined, (h) => {
        const keys = range(prefix)
        return write(h, store, (s) => void s.delete(keys))
      }),
  }
}
