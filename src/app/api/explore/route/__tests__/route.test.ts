import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { RoundTripResult } from '@/application/ports/RoutingGateway'
import type { RouteCandidate } from '@/domain/explore/types'

const mocks = vi.hoisted(() => ({ requireOwner: vi.fn(), roundTrip: vi.fn() }))
vi.mock('@/lib/ownerRoute', () => ({ requireOwner: mocks.requireOwner }))
// The real use case and validation, with a fake provider behind them.
vi.mock('@/application/usecases/GenerateLoopRoutes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/application/usecases/GenerateLoopRoutes')>()),
  createRoutingGateway: () => ({ roundTrip: mocks.roundTrip }),
}))

const { POST } = await import('../route')

// A fictional start near the demo dataset's mid-Pacific home.
const BODY = { start: [-150, 0], distanceM: 8000, seeds: [1, 2, 3] }
const ATTRIBUTION = '© openrouteservice by HeiGIT | © OpenStreetMap contributors'

function loop(seed: number): RouteCandidate {
  return { seed, coordinates: [[-150, 0], [-150.01, 0], [-150, 0]], distanceM: 8050, durationS: 0, ascentM: null, descentM: null, waytypes: [] }
}

let ip = 0
function post(body: unknown = BODY, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest('https://run.example/api/explore/route', {
      method: 'POST',
      // A new caller each time unless a test says otherwise, so the limiter stays out of the way.
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${++ip % 250}`, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

// Every test starts in a fresh minute: the limiter is the module's own.
let minute = 0

describe('POST /api/explore/route', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.UTC(2026, 9, 22, 12, 0) + ++minute * 120_000)
    vi.stubEnv('RUNOMICS_PRIVATE', '1')
    vi.stubEnv('ORS_API_KEY', 'ors-test-key')
    mocks.requireOwner.mockReset()
    mocks.roundTrip.mockReset()
    mocks.roundTrip.mockImplementation(async ({ seed }: { seed: number }): Promise<RoundTripResult> => ({ ok: true, candidate: loop(seed) }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('who may ask', () => {
    it('refuses an anonymous caller on a public site before reading the body', async () => {
      vi.stubEnv('RUNOMICS_PRIVATE', '')
      mocks.requireOwner.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

      const res = await post('{ not json')

      expect(res.status).toBe(401)
      expect(mocks.roundTrip).not.toHaveBeenCalled()
    })

    it('passes on the 503 of a public site without auth configured', async () => {
      vi.stubEnv('RUNOMICS_PRIVATE', '')
      mocks.requireOwner.mockResolvedValue(NextResponse.json({ error: 'Auth is not configured' }, { status: 503 }))

      expect((await post()).status).toBe(503)
      expect(mocks.roundTrip).not.toHaveBeenCalled()
    })

    it('serves the owner on a public site', async () => {
      vi.stubEnv('RUNOMICS_PRIVATE', '')
      mocks.requireOwner.mockResolvedValue(null)

      expect((await post()).status).toBe(200)
    })

    it('serves anyone the private site’s gate let in, without asking for a token', async () => {
      expect((await post()).status).toBe(200)
      expect(mocks.requireOwner).not.toHaveBeenCalled()
    })
  })

  it('answers the loops with their attribution, never cached', async () => {
    const res = await post({ ...BODY, avoidBusyRoads: true })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ candidates: [loop(1), loop(2), loop(3)], attribution: ATTRIBUTION })
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    // With the request's own signal: a client that moves on stops the batch.
    expect(mocks.roundTrip).toHaveBeenCalledWith({ start: [-150, 0], lengthM: 8000, seed: 1, avoidBusyRoads: true, signal: expect.any(AbortSignal) })
  })

  it.each([
    ['JSON that does not parse', '{ "start": '],
    ['seven seeds', { ...BODY, seeds: [1, 2, 3, 4, 5, 6, 7] }],
  ])('refuses %s as invalid, without calling the provider', async (_label, body) => {
    const res = await post(body)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid route request', reason: 'invalid' })
    expect(mocks.roundTrip).not.toHaveBeenCalled()
  })

  it('says so when no routing key is set', async () => {
    vi.stubEnv('ORS_API_KEY', '')

    const res = await post()

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Route generation is not configured: ORS_API_KEY unset', reason: 'notConfigured' })
    expect(mocks.roundTrip).not.toHaveBeenCalled()
  })

  it('says so when the routing key is malformed, and never echoes it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('ORS_API_KEY', 'ors-test-key\nors-second-key')

    const res = await post()
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ error: 'Route generation is not configured: ORS_API_KEY malformed', reason: 'notConfigured' })
    expect(mocks.roundTrip).not.toHaveBeenCalled()
    expect(String(logged.mock.calls[0]?.[0])).toContain('ORS_API_KEY')
    expect(JSON.stringify(logged.mock.calls)).not.toContain('ors-test-key')
  })

  it.each([
    ['quota', 429, 'dailyQuota'],
    ['noRoute', 422, 'noRoute'],
    ['upstream', 502, 'upstream'],
    ['timeout', 502, 'upstream'],
  ] as const)('answers a batch that failed with %s as %i %s', async (kind, status, reason) => {
    mocks.roundTrip.mockResolvedValue({ ok: false, kind })

    const res = await post()

    expect(res.status).toBe(status)
    expect(await res.json()).toMatchObject({ reason })
    expect(res.headers.get('retry-after')).toBeNull()
  })

  it("tells the client to wait out the provider's per-minute limit", async () => {
    mocks.roundTrip.mockResolvedValue({ ok: false, kind: 'rateLimit' })

    const res = await post()

    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ reason: 'providerLimit', retryAfter: 60 })
    expect(res.headers.get('retry-after')).toBe('60')
  })

  it('answers a refused key as a provider failure, and logs it for the owner', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.roundTrip.mockResolvedValue({ ok: false, kind: 'unauthorized' })

    const res = await post()

    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ reason: 'upstream' })
    expect(String(logged.mock.calls[0]?.[0])).toContain('ORS_API_KEY')
  })

  it('answers with the loops it has when only some seeds failed', async () => {
    mocks.roundTrip.mockImplementation(async ({ seed }: { seed: number }) =>
      seed === 2 ? { ok: true, candidate: loop(2) } : { ok: false, kind: 'quota' },
    )

    const res = await post()

    expect(res.status).toBe(200)
    expect((await res.json()).candidates).toEqual([loop(2)])
  })

  it('allows twelve batches a minute per caller, and says when the next one may come', async () => {
    const caller = { 'x-forwarded-for': '203.0.113.9' }
    for (let i = 0; i < 12; i++) expect((await post(BODY, caller)).status).toBe(200)

    vi.setSystemTime(Date.now() + 15_000)
    const refused = await post(BODY, caller)

    expect(refused.status).toBe(429)
    expect(await refused.json()).toEqual({ error: 'Too many route requests', reason: 'rateLimited', retryAfter: 45 })
    expect(refused.headers.get('retry-after')).toBe('45')
    expect(mocks.roundTrip).toHaveBeenCalledTimes(12 * 3)

    // Another caller is counted on its own.
    expect((await post(BODY, { 'x-forwarded-for': '203.0.113.10' })).status).toBe(200)
  })

  it('answers 500 without detail when something breaks, and logs it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('RUNOMICS_PRIVATE', '')
    mocks.requireOwner.mockRejectedValue(new Error('certificate fetch failed'))

    const res = await post()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal error' })
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(logged).toHaveBeenCalledWith('[explore:route]', expect.any(Error))
  })
})
