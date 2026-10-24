import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoundTripRequest, RoundTripResult, RoutingGateway } from '@/application/ports/RoutingGateway'
import type { RouteCandidate } from '@/domain/explore/types'
import { OpenRouteServiceGateway } from '@/infrastructure/routing/OpenRouteServiceGateway'
import {
  createRoutingGateway,
  generateLoopRoutes,
  parseLoopRequest,
  routingConfig,
  type LoopRequest,
} from '../GenerateLoopRoutes'

// A fictional start near the demo dataset's mid-Pacific home.
const START: [number, number] = [-150, 0]
const REQUEST: LoopRequest = { start: START, distanceM: 8000, seeds: [10, 11, 12], avoidBusyRoads: false }

function loop(seed: number, distanceM: number): RouteCandidate {
  return { seed, coordinates: [[-150, 0], [-150.01, 0], [-150, 0]], distanceM, durationS: 0, ascentM: null, descentM: null, waytypes: [] }
}

function fakeGateway(answer: (req: RoundTripRequest, call: number) => RoundTripResult | Promise<RoundTripResult>) {
  const calls: RoundTripRequest[] = []
  const gateway: RoutingGateway = {
    roundTrip: async (req) => {
      calls.push(req)
      return answer(req, calls.length)
    },
  }
  return { gateway, calls }
}

const found = (seed: number, distanceM: number): RoundTripResult => ({ ok: true, candidate: loop(seed, distanceM) })

describe('generateLoopRoutes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks for one loop per seed, all at once, at the target length', async () => {
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    const { gateway, calls } = fakeGateway(async (req) => {
      await held
      return found(req.seed, 8100)
    })

    const pending = generateLoopRoutes(gateway, { ...REQUEST, avoidBusyRoads: true })
    await Promise.resolve()
    // Every request is out before any has answered.
    expect(calls.map((c) => c.seed)).toEqual([10, 11, 12])
    release()

    expect(await pending).toEqual({ ok: true, candidates: [loop(10, 8100), loop(11, 8100), loop(12, 8100)] })
    expect(calls.every((c) => c.lengthM === 8000 && c.avoidBusyRoads && c.start === START)).toBe(true)
  })

  it('keeps a loop within 15% of the target without asking again', async () => {
    const { gateway, calls } = fakeGateway((req) => found(req.seed, 9200))

    await generateLoopRoutes(gateway, { ...REQUEST, seeds: [1] })

    expect(calls).toHaveLength(1)
  })

  it('asks once more, same seed, scaled by the miss, and keeps the closer loop', async () => {
    const { gateway, calls } = fakeGateway((req, call) => found(req.seed, call === 1 ? 10_000 : 8300))

    const result = await generateLoopRoutes(gateway, { ...REQUEST, seeds: [1] })

    expect(calls.map((c) => [c.seed, c.lengthM])).toEqual([[1, 8000], [1, 6400]])
    expect(result).toEqual({ ok: true, candidates: [loop(1, 8300)] })
  })

  it('keeps the first loop when the second misses by more, or fails', async () => {
    const worse = fakeGateway((req, call) => found(req.seed, call === 1 ? 6000 : 12_000))
    expect(await generateLoopRoutes(worse.gateway, { ...REQUEST, seeds: [1] })).toEqual({ ok: true, candidates: [loop(1, 6000)] })

    const failed = fakeGateway((req, call) => (call === 1 ? found(req.seed, 6000) : { ok: false, kind: 'rateLimit' }))
    expect(await generateLoopRoutes(failed.gateway, { ...REQUEST, seeds: [1] })).toEqual({ ok: true, candidates: [loop(1, 6000)] })
  })

  it('never stretches the second ask past twice the target, or shrinks it below half', async () => {
    const short = fakeGateway((req) => found(req.seed, 1000))
    await generateLoopRoutes(short.gateway, { ...REQUEST, seeds: [1] })
    expect(short.calls[1]?.lengthM).toBe(16_000)

    const long = fakeGateway((req) => found(req.seed, 40_000))
    await generateLoopRoutes(long.gateway, { ...REQUEST, seeds: [1] })
    expect(long.calls[1]?.lengthM).toBe(4000)
  })

  it('answers with the loops it found when only some seeds fail', async () => {
    const { gateway } = fakeGateway((req) => (req.seed === 11 ? found(11, 8000) : { ok: false, kind: 'quota' }))

    expect(await generateLoopRoutes(gateway, REQUEST)).toEqual({ ok: true, candidates: [loop(11, 8000)] })
  })

  it.each([
    [['noRoute', 'timeout', 'quota'], 'quota'],
    [['noRoute', 'rateLimit', 'unauthorized'], 'rateLimit'],
    [['noRoute', 'upstream', 'unauthorized'], 'unauthorized'],
    [['noRoute', 'timeout', 'upstream'], 'upstream'],
    [['noRoute', 'timeout', 'noRoute'], 'timeout'],
    [['noRoute', 'noRoute', 'noRoute'], 'noRoute'],
  ] as const)('answers a batch that found nothing (%j) with the worst reason, %s', async (kinds, worst) => {
    const { gateway } = fakeGateway((req) => ({ ok: false, kind: kinds[req.seed - 10]! }))

    expect(await generateLoopRoutes(gateway, REQUEST)).toEqual({ ok: false, kind: worst })
  })

  it('asks the provider nothing more once the caller has gone: no second try, each call told', async () => {
    const caller = new AbortController()
    const { gateway, calls } = fakeGateway((req) => {
      // The client moves on while the first answer (far off the target) comes back.
      caller.abort()
      return found(req.seed, 10_000)
    })

    const result = await generateLoopRoutes(gateway, { ...REQUEST, seeds: [1] }, { signal: caller.signal })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.signal).toBe(caller.signal)
    expect(result).toEqual({ ok: true, candidates: [loop(1, 10_000)] })
  })

  it('asks for nothing when the caller is gone before the batch starts', async () => {
    const caller = new AbortController()
    caller.abort()
    const { gateway, calls } = fakeGateway((req) => found(req.seed, 8000))

    expect(await generateLoopRoutes(gateway, REQUEST, { signal: caller.signal })).toEqual({ ok: false, kind: 'upstream' })
    expect(calls).toHaveLength(0)
  })

  it('passes each seed its own vias and asks once, however far the tour misses', async () => {
    const vias: [number, number][][] = [[[-150.01, 0]], [[-150, 0.01], [-150.01, 0.01]]]
    const { gateway, calls } = fakeGateway((req) => found(req.seed, 12_000))

    const result = await generateLoopRoutes(gateway, { ...REQUEST, seeds: [10, 11], vias })

    expect(result.ok).toBe(true)
    expect(calls.map((c) => [c.seed, c.vias])).toEqual([[10, vias[0]], [11, vias[1]]])
  })

  it('reads a gateway that throws as a provider failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const gateway: RoutingGateway = { roundTrip: async () => Promise.reject(new Error('bug')) }

    expect(await generateLoopRoutes(gateway, REQUEST)).toEqual({ ok: false, kind: 'upstream' })
  })
})

describe('parseLoopRequest', () => {
  const valid = { start: START, distanceM: 8000, seeds: [0, 1, 2, 3, 4] }

  it('accepts a well-formed body, avoidBusyRoads off unless asked', () => {
    expect(parseLoopRequest(valid)).toEqual({ ...valid, avoidBusyRoads: false })
    expect(parseLoopRequest({ ...valid, avoidBusyRoads: true })?.avoidBusyRoads).toBe(true)
  })

  it('folds repeated seeds into one request each', () => {
    expect(parseLoopRequest({ ...valid, seeds: [3, 3, 4] })?.seeds).toEqual([3, 4])
  })

  it.each([
    ['no body', null],
    ['an array', [START]],
    ['a start that is not a pair', { ...valid, start: [-150] }],
    ['a start with three numbers', { ...valid, start: [-150, 0, 0] }],
    ['a longitude past 180', { ...valid, start: [180.1, 0] }],
    ['a latitude past 90', { ...valid, start: [-150, -90.5] }],
    ['a start in strings', { ...valid, start: ['-150', '0'] }],
    ['a distance under 1 km', { ...valid, distanceM: 999 }],
    ['a distance over 42 km', { ...valid, distanceM: 42_001 }],
    ['a distance in a string', { ...valid, distanceM: '8000' }],
    ['no seeds', { ...valid, seeds: [] }],
    ['seven seeds', { ...valid, seeds: [1, 2, 3, 4, 5, 6, 7] }],
    ['a fractional seed', { ...valid, seeds: [1.5] }],
    ['seeds that are not an array', { ...valid, seeds: 4 }],
    ['avoidBusyRoads as a string', { ...valid, avoidBusyRoads: 'yes' }],
  ])('refuses %s', (_label, body) => {
    expect(parseLoopRequest(body)).toBeNull()
  })

  it('keeps each seed with its vias when it folds the seeds', () => {
    const vias = [[[-150.01, 0]], [[-150, 0.01]], [[-150.01, 0.01]]]
    expect(parseLoopRequest({ ...valid, seeds: [3, 3, 4], vias })).toMatchObject({ seeds: [3, 4], vias: [vias[0], vias[2]] })
  })

  it.each([
    ['vias for fewer seeds', { ...valid, seeds: [1, 2], vias: [[[-150.01, 0]]] }],
    ['an empty via list', { ...valid, seeds: [1], vias: [[]] }],
    ['four vias', { ...valid, seeds: [1], vias: [[[-150.01, 0], [-150.02, 0], [-150.03, 0], [-150.04, 0]]] }],
    ['a via past 90° of latitude', { ...valid, seeds: [1], vias: [[[-150, 91]]] }],
    ['a tour longer than a marathon', { ...valid, seeds: [1], vias: [[[-150.2, 0]]] }],
  ])('refuses %s', (_label, body) => {
    expect(parseLoopRequest(body)).toBeNull()
  })

  it('refuses a number JSON cannot carry', () => {
    expect(parseLoopRequest({ ...valid, distanceM: Infinity })).toBeNull()
    expect(parseLoopRequest({ ...valid, start: [NaN, 0] })).toBeNull()
  })
})

describe('routingConfig', () => {
  it('names the missing key, so a deployment fixes it in one go', () => {
    expect(routingConfig({})).toEqual({ missing: ['ORS_API_KEY'] })
    expect(routingConfig({ ORS_API_KEY: '   ' })).toEqual({ missing: ['ORS_API_KEY'] })
  })

  it('reads the key', () => {
    expect(routingConfig({ ORS_API_KEY: ' ors-key ' })).toEqual({ apiKey: 'ors-key' })
  })

  it('refuses a key no header can carry, so fetch never quotes it in an error', () => {
    for (const key of ['ors-key\nors-other-key', 'ors\r\nkey', 'ors\u0000key', 'ors key', 'orsé-key']) {
      expect(routingConfig({ ORS_API_KEY: key })).toEqual({ malformed: ['ORS_API_KEY'] })
    }
  })

  it('builds the OpenRouteService gateway from it', () => {
    expect(createRoutingGateway({ apiKey: 'ors-key' })).toBeInstanceOf(OpenRouteServiceGateway)
  })
})
