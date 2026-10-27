import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenRouteServiceGateway, ORS_DIRECTIONS_URL, parseCandidate } from '../OpenRouteServiceGateway'

// A fictional start near the demo dataset's mid-Pacific home.
const START: [number, number] = [-150, 0]
const REQUEST = { start: START, lengthM: 8000, seed: 17 }

const LINE = [
  [-150, 0, 12.5],
  [-150.001, 0.001, 13],
  [-150.002, 0, 12],
  [-150, 0, 12.5],
]

function orsAnswer(properties: Record<string, unknown> = {}) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: LINE },
        properties: {
          ascent: 4.2,
          descent: 4.1,
          summary: { distance: 8123.4, duration: 5848.8 },
          extras: {
            waytype: { values: [[0, 1, 3], [1, 3, 7]] },
            surface: { values: [[0, 1, 3], [1, 3, 12]] },
            steepness: { values: [[0, 2, -4], [2, 3, 4]] },
            noise: { values: [[0, 3, 2]] },
          },
          ...properties,
        },
      },
    ],
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('OpenRouteServiceGateway', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const logged = () => vi.mocked(console.error).mock.calls

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const roundTrip = () => new OpenRouteServiceGateway('ors-test-key').roundTrip(REQUEST)

  it('asks for one foot-walking round trip with the bare key, elevation and way types', async () => {
    fetchMock.mockResolvedValue(json(orsAnswer()))

    await roundTrip()

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(ORS_DIRECTIONS_URL)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      Authorization: 'ors-test-key',
      'Content-Type': 'application/json',
      Accept: 'application/geo+json',
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(init.body)).toEqual({
      coordinates: [START],
      elevation: true,
      instructions: false,
      preference: 'recommended',
      units: 'm',
      extra_info: ['waytype', 'surface', 'steepness', 'noise'],
      options: { round_trip: { length: 8000, points: 4, seed: 17 }, avoid_features: ['ferries', 'fords'] },
    })
  })

  it('asks for a tour through the vias, back to the start, instead of a round trip', async () => {
    fetchMock.mockResolvedValue(json(orsAnswer()))
    const vias: [number, number][] = [[-150.01, 0], [-150.01, 0.01]]

    await new OpenRouteServiceGateway('ors-test-key').roundTrip({ ...REQUEST, vias })

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(body.coordinates).toEqual([START, ...vias, START])
    expect(body.options).toEqual({ avoid_features: ['ferries', 'fords'] })
  })

  it('sends the spots to avoid as polygons, all but one that covers the start', async () => {
    fetchMock.mockResolvedValue(json(orsAnswer()))

    await new OpenRouteServiceGateway('ors-test-key').roundTrip({ ...REQUEST, avoid: [[-150.01, 0, 80], [-150, 0, 80]] })

    const polygons = JSON.parse(fetchMock.mock.calls[0]![1].body).options.avoid_polygons
    expect(polygons.type).toBe('MultiPolygon')
    expect(polygons.coordinates).toHaveLength(1)
    const ring: number[][] = polygons.coordinates[0][0]
    expect(ring).toHaveLength(9)
    expect(ring[8]).toEqual(ring[0])
    expect(ring.every(([lon]) => Math.abs(lon! + 150.01) < 0.001)).toBe(true)
  })

  it('reads the loop, its length, climb, way types, surfaces and steepness', async () => {
    fetchMock.mockResolvedValue(json(orsAnswer()))

    expect(await roundTrip()).toEqual({
      ok: true,
      candidate: {
        seed: 17,
        coordinates: LINE,
        distanceM: 8123.4,
        durationS: 5848.8,
        ascentM: 4.2,
        descentM: 4.1,
        waytypes: [[0, 1, 3], [1, 3, 7]],
        surfaces: [[0, 1, 3], [1, 3, 12]],
        steepness: [[0, 2, -4], [2, 3, 4]],
      },
    })
  })

  it.each([
    // What ORS's gateway really answers: 401 only without any key, 403 for a
    // key it refuses as much as for a spent day.
    [401, { error: 'Authorization field missing' }, 'unauthorized'],
    [403, { error: 'Access to this API has been disallowed' }, 'unauthorized'],
    [403, { error: 'Key has expired, please renew' }, 'unauthorized'],
    [403, { error: 'Quota exceeded' }, 'quota'],
    [429, { error: 'Rate limit exceeded' }, 'rateLimit'],
    [404, { error: { code: 2009, message: 'Route could not be found - Unable to find a route between points 1 (-150.0000000 0.0000000) and 2.' } }, 'noRoute'],
    [404, { error: { code: 2010, message: 'Could not find routable point within a radius of 350.0 meters of specified coordinate 0: -150.0000000 0.0000000.' } }, 'noRoute'],
    [400, { error: { code: 2003, message: 'Parameter value is invalid.' } }, 'upstream'],
    [500, { error: { code: 2099, message: 'Unknown internal error.' } }, 'upstream'],
    [502, '<html>Bad gateway</html>', 'upstream'],
  ])('maps a %i to %s', async (status, body, kind) => {
    fetchMock.mockResolvedValue(
      typeof body === 'string' ? new Response(body, { status }) : json(body, status),
    )

    expect(await roundTrip()).toEqual({ ok: false, kind })
  })

  it('logs a refusal without the coordinates it quotes, and never the key', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 2009, message: 'Unable to find a route between points 1 (-150.1234567 0.7654321) and 2.' } }, 404),
    )

    await roundTrip()

    const line = logged().map((call) => call.join(' ')).join('\n')
    expect(line).toMatch(/^\[explore\] openrouteservice said 404/)
    expect(line).not.toMatch(/150\.1234567|0\.7654321|ors-test-key/)
  })

  it.each([
    [401, 'Authorization field missing'],
    [403, 'Access to this API has been disallowed'],
  ])('says to check the key when ORS refuses it with a %i', async (status, error) => {
    fetchMock.mockResolvedValue(json({ error }, status))

    await roundTrip()

    expect(String(logged()[0]?.[0])).toContain('ORS_API_KEY')
    expect(String(logged()[0]?.[0])).toContain(String(status))
  })

  it('never logs the key, even when fetch quotes it in its error', async () => {
    // What undici throws for a key holding a line break, before anything is sent.
    fetchMock.mockRejectedValue(new TypeError('Headers.append: "ors-test-key" is an invalid header value.'))

    expect(await roundTrip()).toEqual({ ok: false, kind: 'upstream' })

    const line = logged().map((call) => call.join(' ')).join('\n')
    expect(line).toContain('invalid header value')
    expect(line).not.toContain('ors-test-key')
  })

  it('reads a call that ran out of time as a timeout, and a dead network as upstream', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    expect(await roundTrip()).toEqual({ ok: false, kind: 'timeout' })

    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    expect(await roundTrip()).toEqual({ ok: false, kind: 'upstream' })
  })

  it('stops waiting when the caller goes, quietly: nothing wrong with the provider', async () => {
    const caller = new AbortController()
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    )

    const pending = new OpenRouteServiceGateway('ors-test-key').roundTrip({ ...REQUEST, signal: caller.signal })
    caller.abort()

    expect(await pending).toEqual({ ok: false, kind: 'upstream' })
    expect(logged()).toEqual([])
  })

  it('reads a 200 without a usable line as upstream', async () => {
    fetchMock.mockResolvedValue(json({ type: 'FeatureCollection', features: [] }))
    expect(await roundTrip()).toEqual({ ok: false, kind: 'upstream' })

    fetchMock.mockResolvedValue(new Response('{"type":"FeatureCol', { status: 200 }))
    expect(await roundTrip()).toEqual({ ok: false, kind: 'upstream' })
  })
})

describe('parseCandidate', () => {
  it('falls back to a top-level distance and duration', () => {
    const answer = orsAnswer({ summary: undefined, distance: 7000, duration: 5000 })
    expect(parseCandidate(answer, 1)).toMatchObject({ distanceM: 7000, durationS: 5000 })
  })

  it('keeps a loop that lost its climb, duration or way types', () => {
    const answer = orsAnswer({ ascent: undefined, descent: 'n/a', summary: { distance: 7000 }, extras: undefined })
    expect(parseCandidate(answer, 1)).toMatchObject({ ascentM: null, descentM: null, durationS: 0, waytypes: [] })
  })

  it('drops way-type ranges that point outside the line', () => {
    const answer = orsAnswer({ extras: { waytype: { values: [[0, 1, 3], [1, 9, 7], [2, 1, 4], [0, 1.5, 3], 'x'] } } })
    expect(parseCandidate(answer, 1)?.waytypes).toEqual([[0, 1, 3]])
  })

  it('refuses a line with a broken point, or without a length', () => {
    const broken = orsAnswer()
    broken.features[0]!.geometry.coordinates = [[-150, 0], [-150, null as unknown as number]]
    expect(parseCandidate(broken, 1)).toBeNull()

    expect(parseCandidate(orsAnswer({ summary: {} }), 1)).toBeNull()
    expect(parseCandidate(orsAnswer({ summary: { distance: 0 } }), 1)).toBeNull()
    expect(parseCandidate(null, 1)).toBeNull()
    expect(parseCandidate({ features: 'no' }, 1)).toBeNull()
  })
})
