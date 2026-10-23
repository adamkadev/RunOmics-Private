import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import type { ExploreAreaRef, RouteCandidate, RoutePreferences, ScoredRoute } from '@/domain/explore/types'
import type { ExploreEngine } from '../exploreEngine'
import { RouteRequestError, type RouteBatch, type RouteBatchRequest } from '../routeApi'
import { useRouteGenerator, type RouteGeneratorInput } from '../useRouteGenerator'

const REF: ExploreAreaRef = { id: 'test', name: 'Testville', version: 'test-1', bbox: [-150, 45, -149.9, 45.1] }
const START: [number, number] = [-149.99, 45.01]
const PREFS: RoutePreferences = { avoidBusyRoads: true, newStreetsFirst: true }
const DEBOUNCE = 40

const loop = (seed: number): RouteCandidate => ({
  seed,
  coordinates: [[-149.99, 45.01], [-149.98, 45.01], [-149.99, 45.01]],
  distanceM: 8000 + seed,
  durationS: 0,
  ascentM: 10,
  descentM: 10,
  waytypes: [],
})
/** Scored in the batch's order, or reversed when "New streets first" is off: a re-rank shows. */
const score = (candidates: RouteCandidate[], prefs: RoutePreferences): ScoredRoute[] =>
  (prefs.newStreetsFirst ? candidates : [...candidates].reverse()).map((candidate) => ({ candidate, score: 0, newShare: 0.5, busyShare: 0, newSteps: [true, false] }))

function setup() {
  const engine = {
    routeStart: vi.fn(async () => START),
    scoreRoutes: vi.fn(async (_ref: ExploreAreaRef, req: { candidates: RouteCandidate[]; prefs: RoutePreferences }) => score(req.candidates, req.prefs)),
  }
  const request = vi.fn<(req: RouteBatchRequest, options?: { user?: User | null }) => Promise<RouteBatch>>(async (req) => ({ candidates: req.seeds.map(loop), attribution: '' }))
  const deps = { engineFor: () => engine as unknown as ExploreEngine, request, debounceMs: DEBOUNCE }
  const base: RouteGeneratorInput = { enabled: true, area: REF, unitId: 'test-alpha', km: 8, prefs: PREFS, tracksReady: true, user: null, authReady: true }
  const view = renderHook((input: RouteGeneratorInput) => useRouteGenerator(input, deps), { initialProps: base })
  return { engine, request, base, ...view }
}

const seedsOf = (request: ReturnType<typeof setup>['request'], call: number) => request.mock.calls[call]![0].seeds

describe('useRouteGenerator', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('asks for five loops from the quartier’s start at once, and shows the best', async () => {
    const { result, engine, request } = setup()
    expect(result.current.status).toBe('generating')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(engine.routeStart).toHaveBeenCalledWith(REF, { unitId: 'test-alpha' })
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]![0]).toEqual({ start: START, distanceM: 8000, seeds: [1, 2, 3, 4, 5], avoidBusyRoads: true })
    expect(engine.scoreRoutes).toHaveBeenCalledWith(REF, expect.objectContaining({ targetM: 8000, prefs: PREFS }))
    expect(result.current.route?.candidate.seed).toBe(1)
    expect(result.current.drawn).toBe(result.current.route)
    expect(result.current.routeKey).toBeTruthy()
  })

  it('sends the owner’s token along when there is one, and waits for the owner check', async () => {
    const user = { uid: 'owner' } as unknown as User
    const { result, request, rerender, base } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    request.mockClear()
    // Still checking: nothing goes out.
    rerender({ ...base, unitId: 'test-bravo', authReady: false })
    await new Promise((r) => setTimeout(r, DEBOUNCE * 2))
    expect(request).not.toHaveBeenCalled()
    expect(result.current.status).toBe('generating')
    rerender({ ...base, unitId: 'test-bravo', authReady: true, user })
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    expect(request.mock.calls[0]![1]).toMatchObject({ user })
  })

  it('waits for the runs to be in the worker, so known streets don’t score as new', async () => {
    const { result, request, rerender, base } = setup()
    rerender({ ...base, tracksReady: false })
    await new Promise((r) => setTimeout(r, DEBOUNCE))
    // The first render had them ready; from here, a new quartier waits.
    request.mockClear()
    rerender({ ...base, unitId: 'test-bravo', tracksReady: false })
    await new Promise((r) => setTimeout(r, DEBOUNCE * 2))
    expect(request).not.toHaveBeenCalled()
    expect(result.current.status).toBe('generating')
  })

  it('Regenerate walks down the ranking, then asks for the next five seeds', async () => {
    const { result, request } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const keys = new Set([result.current.routeKey])
    for (const seed of [2, 3, 4, 5]) {
      act(() => result.current.regenerate())
      expect(result.current.route?.candidate.seed).toBe(seed)
      keys.add(result.current.routeKey)
    }
    expect(keys.size).toBe(5)
    expect(request).toHaveBeenCalledTimes(1)

    act(() => result.current.regenerate())
    expect(result.current.status).toBe('generating')
    // The last loop stays drawn while the next batch comes.
    expect(result.current.drawn?.candidate.seed).toBe(5)
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(seedsOf(request, 1)).toEqual([6, 7, 8, 9, 10])
    expect(result.current.route?.candidate.seed).toBe(6)
  })

  it('waits for the stepper to rest, asks once for the last distance, from the first seeds', async () => {
    const { result, request, rerender, base } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.regenerate())
    rerender({ ...base, km: 8.5 })
    rerender({ ...base, km: 9 })
    rerender({ ...base, km: 9.5 })
    expect(result.current.status).toBe('generating')
    expect(result.current.route).toBeNull()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1]![0]).toMatchObject({ distanceM: 9500, seeds: [1, 2, 3, 4, 5] })
  })

  it('waits for the stepper to rest while the first batch is still out, too', async () => {
    const { result, request, rerender, base } = setup()
    // The first batch never answers: every tap comes before a loop is shown.
    request.mockImplementationOnce(() => new Promise<RouteBatch>(() => {}))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    for (const km of [8.5, 9, 9.5, 10]) {
      rerender({ ...base, km })
      await new Promise((r) => setTimeout(r, 5))
    }
    expect(request).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(request.mock.calls.map(([req]) => req.distanceM)).toEqual([8000, 10000])
  })

  it('asks nothing again when the stepper comes back to the distance in hand, and keeps the loop shown', async () => {
    const { result, request, rerender, base } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.regenerate())
    act(() => result.current.regenerate())
    const key = result.current.routeKey
    rerender({ ...base, km: 8.5 })
    rerender({ ...base, km: 8 })
    await new Promise((r) => setTimeout(r, DEBOUNCE * 3))
    expect(request).toHaveBeenCalledTimes(1)
    expect(result.current.route?.candidate.seed).toBe(3)
    expect(result.current.routeKey).toBe(key)
  })

  it('gives every loop shown its own key, a re-rank’s too', async () => {
    const { result, rerender, base } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const first = result.current.routeKey
    // "New streets first" off: another loop comes first, at the same place in the ranking.
    rerender({ ...base, prefs: { avoidBusyRoads: true, newStreetsFirst: false } })
    await waitFor(() => expect(result.current.route?.candidate.seed).toBe(5))
    expect(result.current.routeKey).not.toBe(first)
    // And back: the same loop as at first, the same key (a save of it still holds).
    rerender({ ...base, prefs: PREFS })
    await waitFor(() => expect(result.current.route?.candidate.seed).toBe(1))
    expect(result.current.routeKey).toBe(first)
  })

  it('drops an answer to an older question', async () => {
    const { result, request, rerender, base } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    let release: (batch: RouteBatch) => void = () => {}
    request.mockImplementationOnce(() => new Promise<RouteBatch>((resolve) => (release = resolve)))
    rerender({ ...base, km: 10 })
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    // A new distance while the 10 km batch is out: its answer must never show.
    rerender({ ...base, km: 12 })
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.route?.candidate.distanceM).toBe(8001)
    act(() => release({ candidates: [{ ...loop(99), distanceM: 10000 }], attribution: '' }))
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current.route?.candidate.seed).toBe(1)
    expect(request.mock.calls[2]![0].distanceM).toBe(12000)
  })

  it('re-ranks the batch in hand when "New streets first" changes, without asking again', async () => {
    const { result, request, rerender, base, engine } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    rerender({ ...base, prefs: { avoidBusyRoads: true, newStreetsFirst: false } })
    await waitFor(() => expect(result.current.route?.candidate.seed).toBe(5))
    expect(request).toHaveBeenCalledTimes(1)
    expect(engine.scoreRoutes).toHaveBeenLastCalledWith(REF, expect.objectContaining({ prefs: { avoidBusyRoads: true, newStreetsFirst: false } }))
  })

  it('asks for a new batch when "Avoid busy roads" changes: the provider routes around them', async () => {
    const { result, request, rerender, base } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    rerender({ ...base, prefs: { avoidBusyRoads: false, newStreetsFirst: true } })
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(request.mock.calls[1]![0].avoidBusyRoads).toBe(false)
  })

  it('reports a failure by its reason, clears the loop, and retries the same seeds', async () => {
    const { result, request } = setup()
    request.mockRejectedValueOnce(new RouteRequestError('providerLimit', 60))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.failure).toBe('providerLimit')
    expect(result.current.route).toBeNull()
    expect(result.current.drawn).toBeNull()

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(seedsOf(request, 1)).toEqual([1, 2, 3, 4, 5])
  })

  it('has no loop for a quartier without a runnable start, and tries the next seeds on Regenerate after none was found', async () => {
    const { result, engine, request } = setup()
    engine.routeStart.mockResolvedValueOnce(null as unknown as [number, number])
    await waitFor(() => expect(result.current.failure).toBe('noRoute'))
    expect(request).not.toHaveBeenCalled()
    act(() => result.current.regenerate())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(seedsOf(request, 0)).toEqual([6, 7, 8, 9, 10])
  })

  it('takes an unexpected failure (the worker’s) as the service not answering', async () => {
    const { result, engine } = setup()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    engine.scoreRoutes.mockRejectedValueOnce(new Error('worker died'))
    await waitFor(() => expect(result.current.failure).toBe('upstream'))
  })

  it('does nothing while closed', async () => {
    const { result, request, rerender, base } = setup()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    rerender({ ...base, enabled: false, km: 12 })
    expect(result.current.status).toBe('idle')
    expect(result.current.drawn).toBeNull()
    await new Promise((r) => setTimeout(r, DEBOUNCE * 2))
    expect(request).toHaveBeenCalledTimes(1)
  })
})
