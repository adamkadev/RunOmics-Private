import { describe, expect, it } from 'vitest'
import { IntervalsNotFoundError, IntervalsRateLimitError } from '@/application/ports/IntervalsCalendarGateway'
import type { IntervalsWorkoutEvent } from '@/application/coaching/intervalsWorkoutEncoding'
import { HttpIntervalsGateway, IntervalsApiError } from '../HttpIntervalsGateway'

const KEY = 'test-key-not-real'

const EVENT: IntervalsWorkoutEvent = {
  category: 'WORKOUT',
  type: 'Run',
  start_date_local: '2026-11-03T00:00:00',
  name: 'Easy Run',
  description: '- 30m 7:50-8:45/km Pace',
  external_id: 'runomics:plan-1:a',
}

interface Call {
  url: string
  init: RequestInit
}

function answer(status: number, body: unknown = null, headers: Record<string, string> = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers })
}

function gateway(responses: (Response | Error)[], options: { athleteId?: string; retries?: number } = {}) {
  const calls: Call[] = []
  const sleeps: number[] = []
  const http = new HttpIntervalsGateway({
    apiKey: KEY,
    athleteId: options.athleteId,
    retries: options.retries,
    fetch: async (url, init) => {
      calls.push({ url, init })
      const next = responses.shift()
      if (!next) throw new Error('no more responses')
      if (next instanceof Error) throw next
      return next
    },
    sleep: async (ms) => {
      sleeps.push(ms)
    },
  })
  return { http, calls, sleeps }
}

const header = (call: Call, name: string) => new Headers(call.init.headers).get(name)

describe('authentication', () => {
  it('sends HTTP Basic with the user name API_KEY and the key as password', async () => {
    const { http, calls } = gateway([answer(200, [])])
    await http.listWorkoutEvents('2026-11-01', '2026-11-30')

    expect(header(calls[0]!, 'authorization')).toBe(`Basic ${Buffer.from(`API_KEY:${KEY}`).toString('base64')}`)
  })

  it('addresses athlete 0 unless one is configured', async () => {
    const own = gateway([answer(200, [])])
    const configured = gateway([answer(200, [])], { athleteId: 'i42' })
    await own.http.listWorkoutEvents('2026-11-01', '2026-11-30')
    await configured.http.listWorkoutEvents('2026-11-01', '2026-11-30')

    expect(own.calls[0]!.url).toBe('https://intervals.icu/api/v1/athlete/0/events?oldest=2026-11-01&newest=2026-11-30&category=WORKOUT')
    expect(configured.calls[0]!.url).toContain('/athlete/i42/events?')
  })

  it('refuses an empty key', () => {
    expect(() => new HttpIntervalsGateway({ apiKey: ' ' })).toThrow(/INTERVALS_API_KEY/)
  })
})

describe('events', () => {
  it('creates through the bulk endpoint with upsert on the external id', async () => {
    const { http, calls } = gateway([answer(200, [{ id: 501, external_id: EVENT.external_id, start_date_local: '2026-11-03T00:00:00', name: 'Easy Run' }])])
    const saved = await http.createEvent(EVENT)

    expect(calls[0]!.url).toBe('https://intervals.icu/api/v1/athlete/0/events/bulk?upsert=true')
    expect(calls[0]!.init.method).toBe('POST')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual([EVENT])
    expect(saved).toEqual({ id: '501', externalId: EVENT.external_id, date: '2026-11-03', name: 'Easy Run' })
  })

  it('updates by event id', async () => {
    const { http, calls } = gateway([answer(200, { id: 501, external_id: EVENT.external_id, start_date_local: '2026-11-04T00:00:00' })])
    const saved = await http.updateEvent('501', { ...EVENT, start_date_local: '2026-11-04T00:00:00' })

    expect(calls[0]!.init.method).toBe('PUT')
    expect(calls[0]!.url).toBe('https://intervals.icu/api/v1/athlete/0/events/501')
    expect(saved.date).toBe('2026-11-04')
  })

  it('deletes by event id', async () => {
    const { http, calls } = gateway([answer(200)])
    await http.deleteEvent('501')

    expect(calls[0]!.init.method).toBe('DELETE')
    expect(calls[0]!.url).toBe('https://intervals.icu/api/v1/athlete/0/events/501')
  })

  it('reads a missing event as null and a missing delete as not found', async () => {
    const { http } = gateway([answer(404), answer(404)])

    await expect(http.getEvent('501')).resolves.toBeNull()
    await expect(http.deleteEvent('501')).rejects.toBeInstanceOf(IntervalsNotFoundError)
  })

  it('refuses a create answered without an id', async () => {
    const { http } = gateway([answer(200, [])])

    await expect(http.createEvent(EVENT)).rejects.toThrow(/without an event id/)
  })
})

describe('retries', () => {
  it('waits out a 429 for as long as Retry-After asks, then succeeds', async () => {
    const { http, calls, sleeps } = gateway([answer(429, null, { 'Retry-After': '7' }), answer(200, [])])
    await http.listWorkoutEvents('2026-11-01', '2026-11-30')

    expect(calls).toHaveLength(2)
    expect(sleeps).toEqual([7_000])
  })

  it('backs off on 5xx and network errors', async () => {
    const { http, sleeps } = gateway([answer(502), new Error('socket hang up'), answer(200, [])])
    await http.listWorkoutEvents('2026-11-01', '2026-11-30')

    expect(sleeps).toEqual([1_000, 2_000])
  })

  it('gives up with a rate-limit error after the last retry', async () => {
    const { http, calls } = gateway([answer(429), answer(429)], { retries: 1 })

    await expect(http.listWorkoutEvents('2026-11-01', '2026-11-30')).rejects.toBeInstanceOf(IntervalsRateLimitError)
    expect(calls).toHaveLength(2)
  })

  it('does not retry a client error', async () => {
    const { http, calls } = gateway([answer(400, { error: 'bad date' })])

    await expect(http.createEvent(EVENT)).rejects.toThrow(/HTTP 400: \{"error":"bad date"\}/)
    expect(calls).toHaveLength(1)
  })
})

describe('errors', () => {
  it('names the variables to check on a refused key, without the key', async () => {
    const { http } = gateway([answer(401, { error: 'unauthorized' })])
    const error = await http.listWorkoutEvents('2026-11-01', '2026-11-30').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(IntervalsApiError)
    expect((error as IntervalsApiError).status).toBe(401)
    expect((error as Error).message).toMatch(/INTERVALS_API_KEY and INTERVALS_ATHLETE_ID/)
    expect((error as Error).message).not.toContain(KEY)
  })

  it('reports a request that never answered', async () => {
    const { http } = gateway([new Error('The operation was aborted due to timeout')], { retries: 0 })

    await expect(http.deleteEvent('501')).rejects.toThrow(/DELETE \/api\/v1\/athlete\/0\/events\/501 failed: The operation was aborted/)
  })
})
