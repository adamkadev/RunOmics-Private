import { parseAreaFile } from '@/domain/explore/areaFile'
import {
  activityCells,
  aggregateCoverage,
  buildAreaIndex,
  type ActivityCoverageInput,
  type AreaIndex,
} from '@/domain/explore/coverage'
import { medianStart } from '@/domain/explore/home'
import { routeStart, scoreRoutes } from '@/domain/explore/routeScore'
import type { ExploreAreaFile, ExploreAreaRef } from '@/domain/explore/types'
import { areaCacheKey, trackCacheKey, type ExploreCache } from './idb'
import { flattenRoute, isValidTrackBuffers } from './trackBuffers'
import {
  areaKey,
  type AddedTracks,
  type ClusterTrackRef,
  type ExploreRequest,
  type ExploreResponse,
  type ExploreResults,
  type ExploreRequestType,
  type LonLat,
  type RequestOf,
} from './workerProtocol'

/**
 * Everything the Explore worker does, as plain functions over a state object.
 *
 * `explore.worker.ts` only wires `handleMessage` to `self`, so this module
 * runs in node under test with a fake fetch and cache. It keeps one entry per
 * area (the parsed file, its index and each run's reduced result) for the
 * life of the worker, which lives as long as the page.
 *
 * Requests for one area run one after another, in the order they arrived:
 * a `coverage` sent right after `addTracks` must count the tracks just
 * added, even when adding them waited on IndexedDB.
 */

/**
 * Bump when `activityCells` would give a different answer for the same track
 * and area (grid sampling, step rules), so cached results are recomputed.
 */
export const COVERAGE_ALGO = 1

/** A response just big enough for the worker: same-origin JSON. */
export interface FetchResponse {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

export interface WorkerDeps {
  fetch: (url: string) => Promise<FetchResponse>
  cache: ExploreCache
}

export interface AreaState {
  area: ExploreAreaFile
  index: AreaIndex
  /** Each run's cells and metres, by activity id. */
  activities: Map<string, ActivityCoverageInput>
  /** Each run's first point, kept in memory only: their median is close to home. */
  starts: Map<string, LonLat>
  /** Union of every run's cells, built on demand and dropped when a run is added. */
  visited: Set<number> | null
}

export interface WorkerState {
  /** By `areaKey(ref)`. */
  areas: Map<string, AreaState>
  queues: Map<string, Promise<unknown>>
}

export function createWorkerState(): WorkerState {
  return { areas: new Map(), queues: new Map() }
}

/** The shape stored in the `tracks` store. */
export interface CachedTrack {
  algo: number
  /** `trackFingerprint` of the points the result was computed from. */
  track: string
  date: string
  cells: Uint32Array
  metresByUnit: Float64Array
}

/**
 * A short digest of a track's points: their count and a 32-bit MurmurHash3
 * of the coordinates at 1e-7° (about 1 cm), so the same points always give
 * the same digest whether they came packed from the page or as JSON here.
 *
 * It is what ties a cached result to its track. The activity id does not:
 * a reprocess rewrites routes under the same ids,
 * and a page left open across a data deployment can pair an id with a
 * neighbour's track. Hashing every point costs a fraction of the walk it
 * saves.
 */
export function trackFingerprint(coords: ArrayLike<number>): string {
  let h = 0x9747b28c
  for (let k = 0; k < coords.length; k++) {
    let q = Math.imul(Math.round(coords[k]! * 1e7) | 0, 0xcc9e2d51)
    q = Math.imul((q << 15) | (q >>> 17), 0x1b873593)
    h ^= q
    h = (Math.imul((h << 13) | (h >>> 19), 5) + 0xe6546b64) | 0
  }
  h ^= coords.length
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return `${Math.floor(coords.length / 2)}:${(h >>> 0).toString(36)}`
}

/**
 * A cached run result, or null when the entry is missing, stale, not ours,
 * or was computed from other points than `fingerprint` names.
 */
export function readCachedTrack(
  value: unknown,
  unitCount: number,
  fingerprint: string,
): { cells: number[]; metresByUnit: Float64Array } | null {
  if (typeof value !== 'object' || value === null) return null
  const entry = value as Partial<CachedTrack>
  if (entry.algo !== COVERAGE_ALGO || entry.track !== fingerprint) return null
  if (!(entry.cells instanceof Uint32Array) || !(entry.metresByUnit instanceof Float64Array)) return null
  if (entry.metresByUnit.length !== unitCount) return null
  return { cells: Array.from(entry.cells), metresByUnit: entry.metresByUnit }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return typeof err === 'string' && err ? err : 'Explore worker error'
}

/** Runs `task` after every earlier task queued under `key`, whether they succeeded or not. */
function serial<T>(state: WorkerState, key: string, task: () => Promise<T>): Promise<T> {
  const previous = state.queues.get(key) ?? Promise.resolve()
  const next = previous.then(task, task)
  const settled = next.then(
    () => undefined,
    () => undefined,
  )
  state.queues.set(key, settled)
  void settled.then(() => {
    if (state.queues.get(key) === settled) state.queues.delete(key)
  })
  return next
}

function requireArea(state: WorkerState, key: string): AreaState {
  const area = state.areas.get(key)
  if (!area) throw new Error(`Area not loaded: ${key}`)
  return area
}

function areaUrl(ref: ExploreAreaRef): string {
  return `/api/explore/areas/${encodeURIComponent(ref.id)}?v=${encodeURIComponent(ref.version)}`
}

/**
 * Drops cached files of the area's other versions, and the run results
 * computed on them: a rebuilt area makes them dead weight.
 */
async function pruneStale(cache: ExploreCache, id: string, current: string): Promise<void> {
  const keep = areaCacheKey(id, current)
  for (const key of await cache.keys('areas', `${id}:`)) {
    if (key === keep) continue
    await cache.delete('areas', key)
    await cache.deletePrefix('tracks', `${key.slice(id.length + 1)}:`)
  }
}

async function loadArea(state: WorkerState, ref: ExploreAreaRef, deps: WorkerDeps): Promise<ExploreAreaFile> {
  const key = areaKey(ref)
  const loaded = state.areas.get(key)
  if (loaded) return loaded.area

  let area = parseAreaFile(await deps.cache.get('areas', areaCacheKey(ref.id, ref.version)))
  if (!area || area.runomics.id !== ref.id) {
    const res = await deps.fetch(areaUrl(ref))
    if (!res.ok) throw new Error(`Area ${ref.id}: HTTP ${res.status}`)
    area = parseAreaFile(await res.json())
    if (!area || area.runomics.id !== ref.id) throw new Error(`Area ${ref.id}: not a valid area file`)
    // Stored under the version it really has: a page built before the
    // latest deployment may ask for an older one.
    const version = area.runomics.version
    void deps.cache
      .put('areas', areaCacheKey(ref.id, version), area)
      .then(() => pruneStale(deps.cache, ref.id, version))
      .catch(() => {})
  }

  state.areas.set(key, {
    area,
    index: buildAreaIndex(area),
    activities: new Map(),
    starts: new Map(),
    visited: null,
  })
  return area
}

interface IncomingTrack {
  id: string
  date: string
  coords: ArrayLike<number>
}

/**
 * Reduces new runs to their cells, from the cache where it has them. Runs
 * the area already holds are skipped, so sending one twice costs nothing.
 * A cached result is used only for the very points it was computed from,
 * and one that is not is computed again and overwritten.
 */
async function addActivities(area: AreaState, tracks: readonly IncomingTrack[], deps: WorkerDeps): Promise<string[]> {
  const fresh: IncomingTrack[] = []
  const seen = new Set<string>()
  for (const track of tracks) {
    if (area.activities.has(track.id) || seen.has(track.id) || track.coords.length < 2) continue
    seen.add(track.id)
    fresh.push(track)
  }
  if (fresh.length === 0) return []

  const { index } = area
  const unitCount = index.units.length
  const cached = await deps.cache.getMany(
    'tracks',
    fresh.map((t) => trackCacheKey(index.version, t.id)),
  )
  const toStore: [string, CachedTrack][] = []

  fresh.forEach((track, k) => {
    const date = track.date.slice(0, 10)
    const fingerprint = trackFingerprint(track.coords)
    let result = readCachedTrack(cached[k], unitCount, fingerprint)
    if (!result) {
      result = activityCells(index, track.coords)
      toStore.push([
        trackCacheKey(index.version, track.id),
        { algo: COVERAGE_ALGO, track: fingerprint, date, cells: Uint32Array.from(result.cells), metresByUnit: result.metresByUnit },
      ])
    }
    area.activities.set(track.id, { id: track.id, date, cells: result.cells, metresByUnit: result.metresByUnit })
    area.starts.set(track.id, [track.coords[0]!, track.coords[1]!])
  })
  area.visited = null

  if (toStore.length > 0) void deps.cache.putMany('tracks', toStore)
  return fresh.map((t) => t.id)
}

function addTracks(area: AreaState, msg: RequestOf<'addTracks'>, deps: WorkerDeps): Promise<string[]> {
  if (!isValidTrackBuffers(msg)) throw new Error('Invalid track buffers')
  const tracks = msg.ids.map(
    (id, k): IncomingTrack => ({
      id,
      date: msg.dates[k]!,
      coords: msg.coords.subarray(2 * msg.offsets[k]!, 2 * msg.offsets[k + 1]!),
    }),
  )
  return addActivities(area, tracks, deps)
}

/**
 * Where each wanted run's track sits in a `/api/map/routes` answer, by the
 * activity ids the answer itself gives.
 *
 * The page's `routeIdx` comes from the data the page was built with, the
 * answer from whichever deployment serves it now, and one run synced in
 * between moves every index by one (the newest run comes first). So an
 * index is taken only where the answer names the same run; otherwise the run
 * is found by its id, and a run the answer does not hold is left out rather
 * than given another run's track.
 */
export function locateClusterTracks(
  wanted: readonly ClusterTrackRef[],
  ids: Readonly<Record<string, unknown>>,
): Map<string, string> {
  let byId: Map<unknown, string> | null = null
  const found = new Map<string, string>()
  for (const ref of wanted) {
    const at = String(ref.routeIdx)
    if (ids[at] === ref.id) {
      found.set(ref.id, at)
      continue
    }
    byId ??= new Map(Object.entries(ids).map(([index, id]) => [id, index]))
    const moved = byId.get(ref.id)
    if (moved !== undefined) found.set(ref.id, moved)
  }
  return found
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/**
 * Fetches a cluster's tracks itself, so the 2 MB of JSON is parsed here
 * rather than on the main thread, and adds the runs of `index` it lacks,
 * each with the track the answer gives under its own id.
 */
async function fetchClusterTracks(
  area: AreaState,
  msg: RequestOf<'fetchClusterTracks'>,
  deps: WorkerDeps,
): Promise<string[]> {
  const wanted = msg.index.filter((ref) => !area.activities.has(ref.id))
  if (wanted.length === 0) return []

  const res = await deps.fetch(`/api/map/routes?cluster=${encodeURIComponent(msg.clusterId)}`)
  if (!res.ok) throw new Error(`Cluster ${msg.clusterId}: HTTP ${res.status}`)
  const json: unknown = await res.json()
  const routes = isRecord(json) ? json.routes : undefined
  const ids = isRecord(json) ? json.ids : undefined
  if (!isRecord(routes)) throw new Error(`Cluster ${msg.clusterId}: no routes`)
  if (!isRecord(ids)) throw new Error(`Cluster ${msg.clusterId}: no route ids`)

  const located = locateClusterTracks(wanted, ids)
  const tracks = wanted.flatMap((ref): IncomingTrack[] => {
    const at = located.get(ref.id)
    return at === undefined ? [] : [{ id: ref.id, date: ref.date, coords: flattenRoute(routes[at]) }]
  })
  return addActivities(area, tracks, deps)
}

/** The home given, else (asked for) the median start of the runs counted - `ids`, or every run added. */
function homeOf(area: AreaState, home: LonLat | null, fromTracks: boolean | undefined, ids: readonly string[] | undefined): LonLat | null {
  if (home) return home
  if (!fromTracks) return null
  const starts = ids === undefined ? [...area.starts.values()] : ids.flatMap((id): LonLat[] => {
    const start = area.starts.get(id)
    return start ? [start] : []
  })
  return medianStart(starts)
}

function visitedCells(area: AreaState): Set<number> {
  if (area.visited) return area.visited
  const visited = new Set<number>()
  for (const { cells } of area.activities.values()) {
    for (let k = 0; k < cells.length; k++) visited.add(cells[k]!)
  }
  area.visited = visited
  return visited
}

function coverage(area: AreaState, msg: RequestOf<'coverage'>): ExploreResults['coverage'] {
  const ids = msg.activityIds === undefined ? undefined : [...new Set(msg.activityIds)]
  const selected = ids === undefined ? [...area.activities.values()] : ids.flatMap((id) => area.activities.get(id) ?? [])
  return aggregateCoverage(area.index, selected, homeOf(area, msg.home, msg.homeFromTracks, ids))
}

function score(area: AreaState, msg: RequestOf<'scoreRoutes'>): ExploreResults['scoreRoutes'] {
  if (!Array.isArray(msg.candidates)) throw new Error('Invalid route candidates')
  // New ground means ground no run has touched, whatever the map filters say.
  return scoreRoutes(area.index, visitedCells(area), msg.candidates, msg.targetM, msg.prefs)
}

function added(ids: string[]): AddedTracks {
  return { added: ids }
}

function dispatch(
  state: WorkerState,
  msg: ExploreRequest,
  deps: WorkerDeps,
): Promise<ExploreResults[ExploreRequestType]> {
  switch (msg.type) {
    case 'loadArea':
      return serial(state, areaKey(msg.ref), () => loadArea(state, msg.ref, deps))
    case 'addTracks':
      return serial(state, msg.areaKey, async () => added(await addTracks(requireArea(state, msg.areaKey), msg, deps)))
    case 'fetchClusterTracks':
      return serial(state, msg.areaKey, async () =>
        added(await fetchClusterTracks(requireArea(state, msg.areaKey), msg, deps)),
      )
    case 'coverage':
      return serial(state, msg.areaKey, async () => coverage(requireArea(state, msg.areaKey), msg))
    case 'scoreRoutes':
      return serial(state, msg.areaKey, async () => score(requireArea(state, msg.areaKey), msg))
    case 'routeStart':
      return serial(state, msg.areaKey, async () => routeStart(requireArea(state, msg.areaKey).index, msg.unitId))
    default:
      return Promise.reject(new Error(`Unknown request: ${String((msg as { type?: unknown }).type)}`))
  }
}

/**
 * Answers one request. Never rejects: a failure comes back as `{ id, error }`
 * for the engine to reject that one caller with.
 */
export async function handleMessage(state: WorkerState, msg: ExploreRequest, deps: WorkerDeps): Promise<ExploreResponse> {
  const id = typeof msg === 'object' && msg !== null && typeof msg.id === 'number' ? msg.id : -1
  try {
    if (id < 0) throw new Error('Request without an id')
    return { id, result: await dispatch(state, msg, deps) }
  } catch (err) {
    return { id, error: errorMessage(err) }
  }
}
