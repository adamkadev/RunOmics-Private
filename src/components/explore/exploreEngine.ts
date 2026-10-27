import type { RoutePlan } from '@/domain/explore/routePlan'
import type { AreaCoverage, ExploreAreaFile, ExploreAreaRef, ScoredRoute } from '@/domain/explore/types'
import { selectTracks } from './trackBuffers'
import {
  areaKey,
  type AddedTracks,
  type CoverageOptions,
  type ExploreRequestType,
  type ExploreResponse,
  type ExploreResults,
  type LonLat,
  type RequestOf,
  type RoutePlanRequest,
  type RouteStartRequest,
  type ScoreRoutesRequest,
  type TrackBuffers,
} from './workerProtocol'

/**
 * The worker is created on the first call, so a page that never shows Districts never starts one.
 * Every call waits for its area's load, so callers never have to order them.
 */

export interface ExploreEngine {
  /** The area file, fetched (or read from IndexedDB) by the worker. */
  loadArea(ref: ExploreAreaRef): Promise<ExploreAreaFile>
  /**
   * Adds runs to the area. Runs already sent are left out. When every run
   * in `tracks` is new, its buffers are transferred and unusable afterwards.
   */
  addTracks(ref: ExploreAreaRef, tracks: TrackBuffers): Promise<AddedTracks>
  /** The worker fetches the cluster's tracks itself and adds the runs of `index`. */
  coverage(ref: ExploreAreaRef, options: CoverageOptions): Promise<AreaCoverage>
  /** Best first; new ground is measured against every run sent, whatever the filters. */
  scoreRoutes(ref: ExploreAreaRef, request: ScoreRoutesRequest): Promise<ScoredRoute[]>
  routeStart(ref: ExploreAreaRef, request: RouteStartRequest): Promise<LonLat | null>
  routePlan(ref: ExploreAreaRef, request: RoutePlanRequest): Promise<RoutePlan | null>
  /** The ids of `ids` not sent to the worker yet, so a caller can pack only those. */
  unsent(ref: ExploreAreaRef, ids: readonly string[]): string[]
  /** Stops the worker and rejects whatever is pending. */
  dispose(): void
}

interface Pending {
  resolve: (value: never) => void
  reject: (reason: Error) => void
}

/** The ref without whatever else the caller's object carries: only this is cloned to the worker. */
function plainRef({ id, name, version, bbox }: ExploreAreaRef): ExploreAreaRef {
  return { id, name, version, bbox }
}

function transferList(buffers: readonly ArrayBufferLike[]): Transferable[] {
  // Listing one buffer twice makes postMessage throw.
  return [...new Set(buffers)].filter((b): b is ArrayBuffer => b instanceof ArrayBuffer)
}

export function createExploreEngine(createWorker: () => Worker): ExploreEngine {
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<number, Pending>()
  const areas = new Map<string, Promise<ExploreAreaFile>>()
  const sent = new Map<string, Set<string>>()

  function reset(reason: Error) {
    const dead = worker
    worker = null
    try {
      dead?.terminate()
    } catch {
      // Already gone.
    }
    const callers = [...pending.values()]
    pending.clear()
    areas.clear()
    sent.clear()
    for (const caller of callers) caller.reject(reason)
  }

  function onMessage(event: MessageEvent<ExploreResponse>) {
    const message = event.data
    const caller = pending.get(message.id)
    if (!caller) return
    pending.delete(message.id)
    if ('error' in message) caller.reject(new Error(message.error))
    else caller.resolve(message.result as never)
  }

  function ensureWorker(): Worker {
    if (worker) return worker
    const created = createWorker()
    created.addEventListener('message', onMessage)
    // Not prevented: a worker that fails to load is a bug the console should show.
    created.addEventListener('error', (event: ErrorEvent) => {
      if (worker === created) reset(new Error(event.message || 'The Explore worker failed'))
    })
    created.addEventListener('messageerror', () => {
      if (worker === created) reset(new Error('The Explore worker sent an unreadable message'))
    })
    worker = created
    return created
  }

  function call<K extends ExploreRequestType>(body: RequestOf<K>, transfer: Transferable[] = []): Promise<ExploreResults[K]> {
    return new Promise<ExploreResults[K]>((resolve, reject) => {
      const id = nextId++
      try {
        const target = ensureWorker()
        pending.set(id, { resolve: resolve as (value: never) => void, reject })
        target.postMessage({ ...body, id }, transfer)
      } catch (err) {
        pending.delete(id)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  function sentTo(key: string): Set<string> {
    let ids = sent.get(key)
    if (!ids) {
      ids = new Set()
      sent.set(key, ids)
    }
    return ids
  }

  function loadArea(ref: ExploreAreaRef): Promise<ExploreAreaFile> {
    const key = areaKey(ref)
    const loading = areas.get(key)
    if (loading) return loading
    const load = call<'loadArea'>({ type: 'loadArea', ref: plainRef(ref) })
    areas.set(key, load)
    // A failed load is forgotten, so the next call tries again.
    load.catch(() => {
      if (areas.get(key) === load) areas.delete(key)
    })
    return load
  }

  async function addTracks(ref: ExploreAreaRef, tracks: TrackBuffers): Promise<AddedTracks> {
    await loadArea(ref)
    const key = areaKey(ref)
    const known = sentTo(key)
    const keep: number[] = []
    const picked = new Set<string>()
    tracks.ids.forEach((id, k) => {
      if (known.has(id) || picked.has(id)) return
      picked.add(id)
      keep.push(k)
    })
    if (keep.length === 0) return { added: [] }

    const batch = keep.length === tracks.ids.length ? tracks : selectTracks(tracks, keep)
    // Marked before the answer, so a second call made meanwhile sends nothing twice.
    for (const id of batch.ids) known.add(id)
    try {
      return await call<'addTracks'>(
        { type: 'addTracks', areaKey: key, ...batch },
        transferList([batch.offsets.buffer, batch.coords.buffer]),
      )
    } catch (err) {
      for (const id of batch.ids) known.delete(id)
      throw err
    }
  }

  async function coverage(ref: ExploreAreaRef, options: CoverageOptions): Promise<AreaCoverage> {
    await loadArea(ref)
    const { activityIds, home, homeFromTracks } = options
    return call<'coverage'>({
      type: 'coverage',
      areaKey: areaKey(ref),
      activityIds: activityIds ? [...activityIds] : undefined,
      home,
      homeFromTracks,
    })
  }

  async function scoreRoutes(ref: ExploreAreaRef, request: ScoreRoutesRequest): Promise<ScoredRoute[]> {
    await loadArea(ref)
    const { candidates, targetM, prefs, context } = request
    return call<'scoreRoutes'>({ type: 'scoreRoutes', areaKey: areaKey(ref), candidates, targetM, prefs, ...(context ? { context } : {}) })
  }

  async function routeStart(ref: ExploreAreaRef, request: RouteStartRequest): Promise<LonLat | null> {
    await loadArea(ref)
    const { unitId, avoid } = request
    return call<'routeStart'>({ type: 'routeStart', areaKey: areaKey(ref), unitId, ...(avoid?.length ? { avoid: [...avoid] } : {}) })
  }

  async function routePlan(ref: ExploreAreaRef, request: RoutePlanRequest): Promise<RoutePlan | null> {
    await loadArea(ref)
    const { unitId, origin, home, homeFromTracks, distanceM, seeds, avoid } = request
    return call<'routePlan'>({
      type: 'routePlan',
      areaKey: areaKey(ref),
      unitId,
      origin,
      home,
      homeFromTracks,
      distanceM,
      seeds: [...seeds],
      ...(avoid?.length ? { avoid: [...avoid] } : {}),
    })
  }

  function unsent(ref: ExploreAreaRef, ids: readonly string[]): string[] {
    const known = sent.get(areaKey(ref))
    return known ? ids.filter((id) => !known.has(id)) : [...ids]
  }

  return {
    loadArea,
    addTracks,
    coverage,
    scoreRoutes,
    routeStart,
    routePlan,
    unsent,
    dispose: () => reset(new Error('The Explore engine was disposed')),
  }
}

let shared: ExploreEngine | null = null

/** The `new Worker(new URL(…, import.meta.url))` call is written out literally so Turbopack can find the worker and bundle it. */
export function getExploreEngine(): ExploreEngine {
  shared ??= createExploreEngine(
    () => new Worker(new URL('./explore.worker.ts', import.meta.url), { type: 'module' }),
  )
  return shared
}
