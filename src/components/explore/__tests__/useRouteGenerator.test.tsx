import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvoidSpot } from '@/domain/explore/avoidSpots'
import { NO_SESSION } from '@/domain/explore/climbBudget'
import type { RouteContext } from '@/domain/explore/routeScore'
import type { ExploreAreaRef, RouteCandidate, RoutePreferences, ScoredRoute } from '@/domain/explore/types'
import type { ExploreEngine } from '../exploreEngine'
import { RouteRequestError, type RouteBatch, type RouteBatchRequest } from '../routeApi'
import { ROUTE_BATCH } from '../routeGenerator'
import { useRouteGenerator, type RouteGeneratorInput } from '../useRouteGenerator'
import type { LonLat } from '../workerProtocol'

vi.mock('@/lib/reportClientError', () => ({ reportClientError: vi.fn() }))

const AREA: ExploreAreaRef = { id: 'test-area', name: 'Test', version: 'v1', bbox: [-150.05, -0.05, -149.95, 0.05] }
const M = 1 / 111_320
const ORIGIN: LonLat = [-150, 0]
const QUARTIER_START: LonLat = [-149.99, 0.01]
const DEBOUNCE = 400
const PREFS: RoutePreferences = { avoidBusyRoads: true, newStreetsFirst: true, flatForReps: false }
const CONTEXT: RouteContext = { day: NO_SESSION, dark: false }

const east = (m: number): number[] => [ORIGIN[0] + m * M, ORIGIN[1]]
const loop = (seed: number, line: number[][] = [east(0), east(1000), east(0)]): RouteCandidate => ({
  seed,
  coordinates: line,
  distanceM: 8000,
  durationS: 2400,
  ascentM: 40,
  descentM: 40,
  waytypes: [],
  surfaces: [],
  steepness: [],
} as unknown as RouteCandidate)
const scored = (candidate: RouteCandidate, score: number): ScoredRoute =>
  ({ candidate, score, newShare: 0.5, busyShare: 0, trailShare: 0, steepClimbM: 0, newSteps: [] }) as unknown as ScoredRoute
const spot = (id: string, eastM: number, radiusM = 80): AvoidSpot => ({ id, lon: ORIGIN[0] + eastM * M, lat: 0, radiusM, createdAt: '2026-10-26', reason: null, expiresOn: null })

function setup(overrides: Partial<RouteGeneratorInput> = {}) {
  const engine = {
    routeStart: vi.fn(async () => QUARTIER_START),
    routePlan: vi.fn(async (_ref: ExploreAreaRef, { seeds }: { seeds: number[] }) => ({ kind: 'tour' as const, vias: seeds.map(() => []) })),
    scoreRoutes: vi.fn(async (_ref: ExploreAreaRef, { candidates, prefs }: { candidates: RouteCandidate[]; prefs: RoutePreferences }) =>
      candidates.map((c) => scored(c, prefs.avoidBusyRoads ? c.seed : -c.seed)).sort((a, b) => a.score - b.score),
    ),
  }
  const request = vi.fn(async (req: RouteBatchRequest, { signal }: { signal?: AbortSignal } = {}): Promise<RouteBatch> => {
    void signal
    return { candidates: req.seeds.map((seed) => loop(seed)), attribution: '' }
  })
  const input: RouteGeneratorInput = {
    enabled: true,
    area: AREA,
    unitId: 'test-unit',
    km: 8,
    prefs: PREFS,
    tracksReady: true,
    user: null,
    authReady: true,
    origin: ORIGIN,
    waiting: false,
    home: null,
    context: CONTEXT,
    avoidSpots: [],
    ...overrides,
  }
  const deps = { engineFor: () => engine as unknown as ExploreEngine, request, debounceMs: DEBOUNCE }
  const hook = renderHook((props: RouteGeneratorInput) => useRouteGenerator(props, deps), { initialProps: input })
  const rerender = (more: Partial<RouteGeneratorInput>) => {
    Object.assign(input, more)
    hook.rerender({ ...input })
  }
  return { ...hook, engine, request, rerender }
}

const settle = () => act(() => vi.advanceTimersByTimeAsync(0))
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRouteGenerator', () => {
  it('asks for the first batch at once and shows its best loop', async () => {
    const { result, request } = setup()
    expect(result.current.status).toBe('generating')
    await settle()
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]![0]).toEqual({ start: ORIGIN, distanceM: 8000, seeds: [1, 2, 3, 4, 5] })
    expect(result.current.status).toBe('ready')
    expect(result.current.route?.candidate.seed).toBe(1)
  })

  it('waits for the stepper to rest after the first batch, and asks once for the distance it stops on', async () => {
    const { result, request, rerender } = setup()
    await settle()
    rerender({ km: 8.5 })
    rerender({ km: 9 })
    await wait(DEBOUNCE - 1)
    expect(request).toHaveBeenCalledTimes(1)
    await wait(1)
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1]![0].distanceM).toBe(9000)
    expect(result.current.status).toBe('ready')
  })

  it('aborts the request in flight when the question changes', async () => {
    const { request, rerender } = setup()
    let signal: AbortSignal | undefined
    request.mockImplementationOnce(async (_req, options = {}) => {
      signal = options.signal
      return new Promise<RouteBatch>(() => {})
    })
    await settle()
    expect(signal?.aborted).toBe(false)
    rerender({ km: 10 })
    expect(signal?.aborted).toBe(true)
  })

  it('re-ranks the batch in hand for Avoid busy roads, the session and the dark, with no new request', async () => {
    const { result, request, engine, rerender } = setup()
    await settle()
    rerender({ prefs: { ...PREFS, avoidBusyRoads: false } })
    await settle()
    expect(result.current.route?.candidate.seed).toBe(5)
    rerender({ context: { day: NO_SESSION, dark: true } })
    await settle()
    expect(request).toHaveBeenCalledTimes(1)
    expect(engine.scoreRoutes).toHaveBeenCalledTimes(3)
    expect(engine.scoreRoutes.mock.calls[2]![1]).toMatchObject({ context: { dark: true } })
  })

  it('walks the ranking on Regenerate, then asks for the next seeds', async () => {
    const { result, request } = setup()
    await settle()
    for (let k = 2; k <= ROUTE_BATCH; k++) {
      act(() => result.current.regenerate())
      expect(result.current.route?.candidate.seed).toBe(k)
    }
    act(() => result.current.regenerate())
    await wait(DEBOUNCE)
    expect(request.mock.calls[1]![0].seeds).toEqual([6, 7, 8, 9, 10])
    expect(result.current.route?.candidate.seed).toBe(6)
  })

  it('asks again on Retry after a failure, and shows the loop it brings', async () => {
    const { result, request } = setup()
    request.mockRejectedValueOnce(new RouteRequestError('providerLimit'))
    await settle()
    expect(result.current.status).toBe('error')
    expect(result.current.failure).toBe('providerLimit')
    act(() => result.current.retry())
    await wait(DEBOUNCE)
    expect(request).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ready')
  })

  it('takes a batch seen lately from its cache, with no request and no wait', async () => {
    const { result, request, rerender } = setup()
    await settle()
    rerender({ km: 9 })
    await wait(DEBOUNCE)
    rerender({ km: 8 })
    await settle()
    expect(request).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ready')
  })

  it('keys the request on the spots in reach only, and sends them to the planner and the provider', async () => {
    const near = spot('near', 2000)
    const { request, engine, rerender } = setup({ avoidSpots: [near] })
    await settle()
    expect(engine.routePlan.mock.calls[0]![1]).toMatchObject({ avoid: [[near.lon, 0, 80]] })
    expect(request.mock.calls[0]![0].avoid).toEqual([[near.lon, 0, 80]])
    rerender({ avoidSpots: [near, spot('far', 9000)] })
    await wait(DEBOUNCE)
    expect(request).toHaveBeenCalledTimes(1)
    rerender({ avoidSpots: [near, spot('close', 500)] })
    await wait(DEBOUNCE)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('drops a loop that runs through a spot, and says no loop when none is left', async () => {
    const { result, request, rerender } = setup({ avoidSpots: [spot('s', 700, 40)] })
    request.mockImplementation(async (req) => ({
      candidates: req.seeds.map((seed) => (seed === 1 ? loop(seed) : loop(seed, [east(0), east(300), east(0)]))),
      attribution: '',
    }))
    await settle()
    expect(result.current.route?.candidate.seed).toBe(2)
    request.mockImplementation(async (req) => ({ candidates: req.seeds.map((seed) => loop(seed)), attribution: '' }))
    rerender({ km: 9 })
    await wait(DEBOUNCE)
    expect(result.current.failure).toBe('noRoute')
  })

  it('works out the quartier’s own start clear of the spots before it asks', async () => {
    const spots = [spot('s', 5000)]
    const { result, request, engine } = setup({ origin: null, avoidSpots: spots })
    await settle()
    await settle()
    expect(engine.routeStart).toHaveBeenCalledWith(AREA, { unitId: 'test-unit', avoid: [[spots[0]!.lon, 0, 80]] })
    expect(engine.routePlan).not.toHaveBeenCalled()
    expect(request.mock.calls[0]![0].start).toEqual(QUARTIER_START)
    expect(result.current.status).toBe('ready')
  })

  it('asks for nothing until the start is tapped', async () => {
    const { result, request } = setup({ origin: null, waiting: true })
    await settle()
    expect(request).not.toHaveBeenCalled()
    expect(result.current.status).toBe('generating')
  })
})
