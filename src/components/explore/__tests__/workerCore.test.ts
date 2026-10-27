import { describe, it, expect, vi } from 'vitest'
import { activityCells, aggregateCoverage, buildAreaIndex } from '@/domain/explore/coverage'
import { medianStart } from '@/domain/explore/home'
import { routeStart } from '@/domain/explore/routeScore'
import type { ExploreAreaRef, RouteCandidate } from '@/domain/explore/types'
import { PROJ, at, line, testArea, track } from '@/domain/explore/__tests__/areaFixture'
import { projectX, projectY } from '@/domain/explore/grid'
import type { ExploreCache, ExploreStore } from '../idb'
import { flattenTracks } from '../trackBuffers'
import {
  COVERAGE_ALGO,
  createWorkerState,
  handleMessage,
  readCachedTrack,
  trackFingerprint,
  type FetchResponse,
  type WorkerDeps,
  type WorkerState,
} from '../workerCore'
import type { ExploreRequest, ExploreRequestBody, ExploreResponse } from '../workerProtocol'

const AREA = testArea()
const VERSION = AREA.runomics.version
const REF: ExploreAreaRef = { id: 'test', name: 'Testville', version: VERSION, bbox: AREA.runomics.bbox }
const KEY = `test:${VERSION}`
const INDEX = buildAreaIndex(AREA)

/** Runs drawn in metres on the fixture (see areaFixture): row 0, column 0, a few metres in Delta. */
const RUNS: Record<string, { date: string; points: [number, number][] }> = {
  r1: { date: '2026-05-01', points: line(30, 75, 1170, 75, 10) },
  r2: { date: '2026-06-15', points: line(75, 30, 75, 570, 10) },
  r3: { date: '2026-04-02', points: line(630, 225, 700, 225, 10) },
}

function lonLatRoute(id: string): [number, number][] {
  return RUNS[id]!.points.map(([x, y]) => at(x, y))
}

function buffers(ids: string[]) {
  return flattenTracks(
    ids.map(lonLatRoute),
    ids.map((_, k) => k),
    ids.map((id) => ({ id, date: RUNS[id]!.date })),
  )
}

class MemoryCache implements ExploreCache {
  stores: Record<ExploreStore, Map<string, unknown>> = { areas: new Map(), tracks: new Map() }
  calls: string[] = []
  /** Holds every read back until `release()`, to prove requests wait their turn. */
  private gate: Promise<void> | null = null
  private open: (() => void) | null = null

  hold() {
    this.gate = new Promise((resolve) => (this.open = resolve))
  }
  release() {
    this.open?.()
    this.gate = null
  }

  async get(store: ExploreStore, key: string) {
    this.calls.push(`get ${store} ${key}`)
    await this.gate
    return this.stores[store].get(key)
  }
  async getMany(store: ExploreStore, keys: readonly string[]) {
    this.calls.push(`getMany ${store} ${keys.length}`)
    await this.gate
    return keys.map((k) => this.stores[store].get(k))
  }
  async put(store: ExploreStore, key: string, value: unknown) {
    this.calls.push(`put ${store} ${key}`)
    this.stores[store].set(key, value)
  }
  async putMany(store: ExploreStore, entries: readonly (readonly [string, unknown])[]) {
    this.calls.push(`putMany ${store} ${entries.length}`)
    for (const [k, v] of entries) this.stores[store].set(k, v)
  }
  async keys(store: ExploreStore, prefix: string) {
    return [...this.stores[store].keys()].filter((k) => k.startsWith(prefix))
  }
  async delete(store: ExploreStore, key: string) {
    this.stores[store].delete(key)
  }
  async deletePrefix(store: ExploreStore, prefix: string) {
    for (const k of [...this.stores[store].keys()]) if (k.startsWith(prefix)) this.stores[store].delete(k)
  }
}

function response(body: unknown, status = 200): FetchResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(JSON.stringify(body)) }
}

function setup({
  area = AREA as unknown,
  status = 200,
} = {}) {
  const cache = new MemoryCache()
  const fetch = vi.fn(async (url: string): Promise<FetchResponse> => {
    if (url.startsWith('/api/explore/areas/')) return response(status === 200 ? area : { error: 'x' }, status)
    return response({ error: 'Not found' }, 404)
  })
  const deps: WorkerDeps = { fetch, cache }
  const state = createWorkerState()
  let nextId = 1
  const send = (body: ExploreRequestBody): Promise<ExploreResponse> =>
    handleMessage(state, { ...body, id: nextId++ } as ExploreRequest, deps)
  return { cache, fetch, deps, state, send }
}

/** The result of a response that must have succeeded. */
function ok<T>(answer: ExploreResponse): T {
  if ('error' in answer) throw new Error(`unexpected error: ${answer.error}`)
  return answer.result as T
}

async function loaded(options?: Parameters<typeof setup>[0]) {
  const ctx = setup(options)
  ok(await ctx.send({ type: 'loadArea', ref: REF }))
  return ctx
}

const flushWrites = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('loadArea', () => {
  it('fetches the area by version, returns it and caches it', async () => {
    const { send, fetch, cache } = setup()

    const area = ok(await send({ type: 'loadArea', ref: REF }))
    await flushWrites()

    expect(area).toEqual(AREA)
    expect(fetch).toHaveBeenCalledWith(`/api/explore/areas/test?v=${encodeURIComponent(VERSION)}`)
    expect(cache.stores.areas.has(KEY)).toBe(true)
  })

  it('loads each area once', async () => {
    const { send, fetch } = setup()

    await Promise.all([send({ type: 'loadArea', ref: REF }), send({ type: 'loadArea', ref: REF })])
    await send({ type: 'loadArea', ref: REF })

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reads a cached area without fetching', async () => {
    const { send, fetch, cache } = setup()
    cache.stores.areas.set(KEY, JSON.parse(JSON.stringify(AREA)))

    expect(ok(await send({ type: 'loadArea', ref: REF }))).toEqual(AREA)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches again when the cached copy is not a valid area', async () => {
    const { send, fetch, cache } = setup()
    cache.stores.areas.set(KEY, { type: 'FeatureCollection' })

    ok(await send({ type: 'loadArea', ref: REF }))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('fails on an HTTP error, and tries again on the next request', async () => {
    const ctx = setup({ status: 404 })

    expect(await ctx.send({ type: 'loadArea', ref: REF })).toMatchObject({ error: 'Area test: HTTP 404' })

    ctx.fetch.mockImplementation(async () => response(AREA))
    expect(ok(await ctx.send({ type: 'loadArea', ref: REF }))).toEqual(AREA)
  })

  it('refuses a file that is not an area, or is another area', async () => {
    const broken = setup({ area: { type: 'FeatureCollection', features: [] } })
    const other = setup({ area: { ...AREA, runomics: { ...AREA.runomics, id: 'elsewhere' } } })

    expect(await broken.send({ type: 'loadArea', ref: REF })).toMatchObject({ error: 'Area test: not a valid area file' })
    expect(await other.send({ type: 'loadArea', ref: REF })).toMatchObject({ error: 'Area test: not a valid area file' })
  })

  it('drops the cached files and run results of older versions', async () => {
    const { send, cache } = setup()
    cache.stores.areas.set('test:test-20250101-00000000', {})
    cache.stores.tracks.set('test-20250101-00000000:r1', {})
    cache.stores.tracks.set(`${VERSION}:r1`, {})
    // Another area whose id starts the same way is left alone.
    cache.stores.areas.set('test-two:test-two-20250101-00000000', {})

    ok(await send({ type: 'loadArea', ref: REF }))
    await flushWrites()

    expect([...cache.stores.areas.keys()].sort()).toEqual([KEY, 'test-two:test-two-20250101-00000000'].sort())
    expect([...cache.stores.tracks.keys()]).toEqual([`${VERSION}:r1`])
  })
})

describe('requests before the area is loaded', () => {
  it('fail with a clear error', async () => {
    const { send } = setup()

    expect(await send({ type: 'coverage', areaKey: KEY, home: null })).toMatchObject({ error: `Area not loaded: ${KEY}` })
  })
})

describe('addTracks and coverage', () => {
  it('gives the same coverage as the domain does', async () => {
    const { send } = await loaded()
    const ids = ['r1', 'r2', 'r3']

    expect(ok(await send({ type: 'addTracks', areaKey: KEY, ...buffers(ids) }))).toEqual({ added: ids })

    const expected = aggregateCoverage(
      INDEX,
      ids.map((id) => ({ id, date: RUNS[id]!.date, ...activityCells(INDEX, track(RUNS[id]!.points)) })),
      at(0, 0),
    )
    expect(ok(await send({ type: 'coverage', areaKey: KEY, home: at(0, 0) }))).toEqual(expected)
  })

  it('skips runs it already has', async () => {
    const { send } = await loaded()
    await send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1']) })

    expect(ok(await send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1', 'r2']) }))).toEqual({ added: ['r2'] })
  })

  it('counts only the runs asked for', async () => {
    const { send } = await loaded()
    await send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1', 'r2', 'r3']) })

    const coverage = ok<{ units: { id: string; visited: number }[] }>(
      await send({ type: 'coverage', areaKey: KEY, activityIds: ['r3', 'r3', 'unknown'], home: null }),
    )
    expect(coverage.units.map((u) => u.visited)).toEqual([0, 0, 1])
  })

  it('takes home from the median start of the runs when asked', async () => {
    const { send } = await loaded()
    await send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1', 'r2', 'r3']) })
    const home = medianStart(['r1', 'r2', 'r3'].map((id) => lonLatRoute(id)[0]!))

    const fromTracks = ok<{ home: unknown }>(await send({ type: 'coverage', areaKey: KEY, home: null, homeFromTracks: true }))
    const without = ok<{ home: unknown }>(await send({ type: 'coverage', areaKey: KEY, home: null }))
    const given = ok<{ home: unknown }>(await send({ type: 'coverage', areaKey: KEY, home: [1, 2], homeFromTracks: true }))

    expect(fromTracks.home).toEqual(home)
    expect(without.home).toBeNull()
    expect(given.home).toEqual([1, 2])
  })

  it('takes that home from the runs asked for alone, not from every run the area holds', async () => {
    const { send } = await loaded()
    // Another cluster's runs, added by the map in the same session, sit in the same area.
    await send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1', 'r2', 'r3']) })
    const own = medianStart(['r1', 'r2'].map((id) => lonLatRoute(id)[0]!))
    expect(own).not.toEqual(medianStart(['r1', 'r2', 'r3'].map((id) => lonLatRoute(id)[0]!)))

    const coverage = ok<{ home: unknown }>(await send({ type: 'coverage', areaKey: KEY, activityIds: ['r1', 'r2'], home: null, homeFromTracks: true }))
    expect(coverage.home).toEqual(own)
  })

  it('answers a coverage sent right after addTracks with the new runs counted', async () => {
    const { send, cache } = await loaded()
    cache.hold()

    const adding = send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1']) })
    const counting = send({ type: 'coverage', areaKey: KEY, home: null })
    await flushWrites()
    cache.release()

    await adding
    const coverage = ok<{ units: { id: string; visited: number }[] }>(await counting)
    expect(coverage.units.find((u) => u.id === 'test-bravo')!.visited).toBe(4)
  })

  it('caches each run result under the area version and reuses it', async () => {
    const first = await loaded()
    await first.send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1']) })
    const stored = first.cache.stores.tracks.get(`${VERSION}:r1`)

    const r1 = trackFingerprint(track(RUNS.r1!.points))
    expect(stored).toMatchObject({ algo: COVERAGE_ALGO, track: r1, date: '2026-05-01' })
    expect(readCachedTrack(stored, INDEX.units.length, r1)).toEqual(activityCells(INDEX, track(RUNS.r1!.points)))

    // A second worker finds the result cached for these very points: it
    // trusts it over walking the track, which is how a cached run costs no walk at all.
    const second = await loaded()
    second.cache.stores.tracks.set(`${VERSION}:r1`, {
      algo: COVERAGE_ALGO,
      track: r1,
      date: '2026-05-01',
      cells: new Uint32Array([INDEX.units[3]!.runnable.values().next().value!]),
      metresByUnit: new Float64Array([0, 0, 0, 1234]),
    })
    await second.send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1']) })
    const coverage = ok<{ units: { id: string; visited: number; kmRun: number }[] }>(
      await second.send({ type: 'coverage', areaKey: KEY, home: null }),
    )

    expect(coverage.units.find((u) => u.id === 'test-delta')).toMatchObject({ visited: 1, kmRun: 1.234 })
    expect(second.cache.calls.filter((c) => c.startsWith('putMany'))).toEqual([])
  })

  it('recomputes a cached result from another algorithm, of the wrong size, or of other points', async () => {
    const entry = { algo: COVERAGE_ALGO, track: 'fp', date: 'x', cells: new Uint32Array(), metresByUnit: new Float64Array(4) }
    expect(readCachedTrack(entry, 4, 'fp')).not.toBeNull()
    expect(readCachedTrack({ ...entry, algo: COVERAGE_ALGO + 1 }, 4, 'fp')).toBeNull()
    expect(readCachedTrack({ ...entry, metresByUnit: new Float64Array(3) }, 4, 'fp')).toBeNull()
    expect(readCachedTrack({ ...entry, cells: [1, 2] }, 4, 'fp')).toBeNull()
    expect(readCachedTrack(entry, 4, 'other')).toBeNull()
    // Written before results were tied to their track.
    expect(readCachedTrack({ ...entry, track: undefined }, 4, 'fp')).toBeNull()
    expect(readCachedTrack(undefined, 4, 'fp')).toBeNull()
  })

  it('recomputes and overwrites a run whose track was rewritten under the same id', async () => {
    // A reprocess rewrites r1: same id, other points.
    const { send, cache } = await loaded()
    const before = activityCells(INDEX, track(RUNS.r3!.points))
    cache.stores.tracks.set(`${VERSION}:r1`, {
      algo: COVERAGE_ALGO,
      track: trackFingerprint(track(RUNS.r3!.points)),
      date: '2026-05-01',
      cells: Uint32Array.from(before.cells),
      metresByUnit: before.metresByUnit,
    })

    await send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1']) })
    const coverage = ok<{ units: { id: string; visited: number }[] }>(await send({ type: 'coverage', areaKey: KEY, home: null }))
    await flushWrites()

    expect(coverage.units.find((u) => u.id === 'test-bravo')!.visited).toBe(4)
    expect(coverage.units.find((u) => u.id === 'test-delta')!.visited).toBe(0)
    expect(cache.stores.tracks.get(`${VERSION}:r1`)).toMatchObject({ track: trackFingerprint(track(RUNS.r1!.points)) })
  })

  it('fingerprints the points, not the buffer they came in', () => {
    const points = lonLatRoute('r2')
    const flat = track(RUNS.r2!.points)
    expect(trackFingerprint(flat)).toBe(trackFingerprint(points.flat()))
    expect(trackFingerprint(flat)).toMatch(/^55:[0-9a-z]+$/)
    // One point moved by 1 m is another track.
    const moved = flat.slice()
    moved[21] = moved[21]! + 1e-5
    expect(trackFingerprint(moved)).not.toBe(trackFingerprint(flat))
    expect(trackFingerprint(flat.subarray(0, flat.length - 2))).not.toBe(trackFingerprint(flat))
  })

  it('refuses buffers that do not add up', async () => {
    const { send } = await loaded()
    const bad = { ...buffers(['r1']), offsets: new Uint32Array([0, 9999]) }

    expect(await send({ type: 'addTracks', areaKey: KEY, ...bad })).toMatchObject({ error: 'Invalid track buffers' })
  })
})

describe('scoreRoutes, routeStart and routePlan', () => {
  const candidate = (seed: number, pointsM: [number, number][]): RouteCandidate => ({
    seed,
    coordinates: pointsM.map(([x, y]) => at(x, y)),
    distanceM: 1200,
    durationS: 400,
    ascentM: null,
    descentM: null,
    waytypes: [],
  })
  const prefs = { avoidBusyRoads: false, newStreetsFirst: true, flatForReps: false }

  it('measures new ground against every run, best first', async () => {
    const { send } = await loaded()
    await send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1']) })
    const known = candidate(1, [[0, 75], [600, 75], [0, 75]])
    const fresh = candidate(2, [[0, 975], [600, 975], [0, 975]])

    const ranked = ok<{ candidate: RouteCandidate; newShare: number }[]>(
      await send({ type: 'scoreRoutes', areaKey: KEY, candidates: [known, fresh], targetM: 1200, prefs }),
    )

    expect(ranked.map((r) => [r.candidate.seed, r.newShare])).toEqual([
      [2, 1],
      [1, 0],
    ])
  })

  it('sees runs added after an earlier scoring', async () => {
    const { send } = await loaded()
    const known = candidate(1, [[0, 75], [600, 75], [0, 75]])
    const score = async () =>
      ok<{ newShare: number }[]>(await send({ type: 'scoreRoutes', areaKey: KEY, candidates: [known], targetM: 1200, prefs }))[0]!
        .newShare

    expect(await score()).toBe(1)
    await send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1']) })
    expect(await score()).toBe(0)
  })

  it('finds the route start from the area alone, whatever runs it holds', async () => {
    const { send } = await loaded()
    const before = ok(await send({ type: 'routeStart', areaKey: KEY, unitId: 'test-delta' }))
    await send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1', 'r2']) })

    expect(before).toEqual(routeStart(INDEX, 'test-delta'))
    expect(ok(await send({ type: 'routeStart', areaKey: KEY, unitId: 'test-delta' }))).toEqual(before)
    expect(ok(await send({ type: 'routeStart', areaKey: KEY, unitId: 'nope' }))).toBeNull()
  })

  it('keeps the vias away from the runs’ median start', async () => {
    const { send } = await loaded()
    await send({ type: 'addTracks', areaKey: KEY, ...buffers(['r1', 'r2']) })

    const plan = ok<{ kind: string; vias: [number, number][][] }>(
      await send({ type: 'routePlan', areaKey: KEY, unitId: 'test-alpha', origin: at(1100, 500), home: null, homeFromTracks: true, distanceM: 3000, seeds: [1, 2] }),
    )

    expect(plan.kind).toBe('tour')
    for (const [lon, lat] of plan.vias.flat()) {
      expect(Math.hypot(projectX(PROJ, lon) - 52.5, projectY(PROJ, lat) - 52.5)).toBeGreaterThanOrEqual(600)
    }
  })
})

describe('handleMessage', () => {
  it('answers an unknown request with an error, under its id', async () => {
    const state: WorkerState = createWorkerState()
    const deps: WorkerDeps = { fetch: vi.fn(), cache: new MemoryCache() }

    expect(await handleMessage(state, { id: 7, type: 'nope' } as unknown as ExploreRequest, deps)).toEqual({
      id: 7,
      error: 'Unknown request: nope',
    })
    expect(await handleMessage(state, {} as ExploreRequest, deps)).toEqual({ id: -1, error: 'Request without an id' })
  })
})
