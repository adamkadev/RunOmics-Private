import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import type { RouteCandidate } from '@/domain/explore/types'
import { ROUTE_ENDPOINT, RouteRequestError, requestRouteBatch, routeFailure, type RouteBatchRequest } from '../routeApi'

const REQUEST: RouteBatchRequest = { start: [-150, 45], distanceM: 8000, seeds: [1, 2, 3, 4, 5], avoidBusyRoads: true }
const LOOP: RouteCandidate = {
  seed: 1,
  coordinates: [[-150, 45], [-149.99, 45], [-150, 45]],
  distanceM: 8000,
  durationS: 5000,
  ascentM: 20,
  descentM: 20,
  waytypes: [[0, 2, 3]],
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

async function failureOf(promise: Promise<unknown>): Promise<RouteRequestError> {
  try {
    await promise
  } catch (err) {
    expect(err).toBeInstanceOf(RouteRequestError)
    return err as RouteRequestError
  }
  throw new Error('expected a failure')
}

describe('routeFailure: an answer as what the panel says', () => {
  it('takes the body’s reason where it names one', () => {
    expect(routeFailure(503, { reason: 'notConfigured' })).toBe('notConfigured')
    expect(routeFailure(429, { reason: 'rateLimited' })).toBe('rateLimited')
    expect(routeFailure(429, { reason: 'providerLimit' })).toBe('providerLimit')
    expect(routeFailure(429, { reason: 'dailyQuota' })).toBe('dailyQuota')
    expect(routeFailure(422, { reason: 'noRoute' })).toBe('noRoute')
    expect(routeFailure(502, { reason: 'upstream' })).toBe('upstream')
    expect(routeFailure(400, { reason: 'invalid' })).toBe('invalid')
  })

  it('falls back on the status: the owner check’s answers carry no reason', () => {
    expect(routeFailure(401, { error: 'Unauthorized' })).toBe('auth')
    expect(routeFailure(403, { error: 'Forbidden' })).toBe('auth')
    // requireOwner without FIREBASE_PROJECT_ID: "Auth is not configured".
    expect(routeFailure(503, { error: 'Auth is not configured' })).toBe('notConfigured')
    expect(routeFailure(429, null)).toBe('rateLimited')
    expect(routeFailure(422, null)).toBe('noRoute')
    expect(routeFailure(400, null)).toBe('invalid')
    expect(routeFailure(500, { error: 'Internal error' })).toBe('upstream')
    // A reason this client doesn't know is the status's.
    expect(routeFailure(403, { reason: 'somethingNew' })).toBe('auth')
  })
})

describe('requestRouteBatch', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the batch, uncached, and hands back the loops and their credit', async () => {
    fetchMock.mockResolvedValue(json({ candidates: [LOOP], attribution: '© openrouteservice' }))
    const batch = await requestRouteBatch(REQUEST)
    expect(batch).toEqual({ candidates: [LOOP], attribution: '© openrouteservice' })
    const [path, init] = fetchMock.mock.calls[0]!
    expect(path).toBe(ROUTE_ENDPOINT)
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store' })
    expect(JSON.parse(init.body)).toEqual(REQUEST)
    // No owner signed in: no token (a private site's cookie does the work).
    expect(init.headers).not.toHaveProperty('authorization')
  })

  it('sends the owner’s token when one is signed in', async () => {
    fetchMock.mockResolvedValue(json({ candidates: [LOOP], attribution: '' }))
    const user = { getIdToken: vi.fn().mockResolvedValue('owner-token') } as unknown as User
    await requestRouteBatch(REQUEST, { user })
    expect(fetchMock.mock.calls[0]![1].headers).toMatchObject({ authorization: 'Bearer owner-token', 'content-type': 'application/json' })
  })

  it('rejects with the failure an error answer names, and its wait', async () => {
    fetchMock.mockResolvedValue(json({ error: 'busy', reason: 'providerLimit', retryAfter: 60 }, 429, { 'retry-after': '60' }))
    const failure = await failureOf(requestRouteBatch(REQUEST))
    expect(failure.reason).toBe('providerLimit')
    expect(failure.retryAfter).toBe(60)
  })

  it('reads the wait from the header when the body has none', async () => {
    fetchMock.mockResolvedValue(json({ error: 'Too many', reason: 'rateLimited' }, 429, { 'retry-after': '12' }))
    expect((await failureOf(requestRouteBatch(REQUEST))).retryAfter).toBe(12)
  })

  it('maps a 503 without a reason to notConfigured, a 401 to auth', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'Auth is not configured' }, 503))
    expect((await failureOf(requestRouteBatch(REQUEST))).reason).toBe('notConfigured')
    fetchMock.mockResolvedValueOnce(json({ error: 'Unauthorized' }, 401))
    expect((await failureOf(requestRouteBatch(REQUEST))).reason).toBe('auth')
  })

  it('takes a network failure or an unreadable answer as the service not answering', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect((await failureOf(requestRouteBatch(REQUEST))).reason).toBe('upstream')
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }))
    expect((await failureOf(requestRouteBatch(REQUEST))).reason).toBe('upstream')
  })

  it('takes an answer with no usable loop as no loop found', async () => {
    fetchMock.mockResolvedValue(json({ candidates: [{ seed: 1, coordinates: [] }], attribution: '' }))
    expect((await failureOf(requestRouteBatch(REQUEST))).reason).toBe('noRoute')
  })

  it('lets an abort through as the abort, not as a failure to word', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(() => {
      controller.abort()
      return Promise.reject(new DOMException('aborted', 'AbortError'))
    })
    await expect(requestRouteBatch(REQUEST, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
