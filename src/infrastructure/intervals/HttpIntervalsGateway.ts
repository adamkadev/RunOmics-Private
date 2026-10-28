import {
  IntervalsNotFoundError,
  IntervalsRateLimitError,
  type IntervalsCalendarGateway,
  type IntervalsEventRecord,
} from '@/application/ports/IntervalsCalendarGateway'
import type { IntervalsWorkoutEvent } from '@/application/coaching/intervalsWorkoutEncoding'

export const INTERVALS_API_BASE = 'https://intervals.icu/api/v1'

type Fetch = (url: string, init: RequestInit) => Promise<Response>

export interface HttpIntervalsGatewayOptions {
  apiKey: string
  athleteId?: string
  baseUrl?: string
  fetch?: Fetch
  timeoutMs?: number
  retries?: number
  sleep?: (ms: number) => Promise<void>
}

export class IntervalsApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message)
    this.name = 'IntervalsApiError'
  }
}

interface RawEvent {
  id?: number | string
  external_id?: string | null
  start_date_local?: string
  name?: string
}

const RETRYABLE = (status: number) => status === 429 || status >= 500

function record(raw: RawEvent | undefined, context: string): IntervalsEventRecord {
  if (!raw || raw.id === undefined || raw.id === null) throw new IntervalsApiError(`intervals.icu answered ${context} without an event id`, null)
  return {
    id: String(raw.id),
    externalId: raw.external_id ?? null,
    date: (raw.start_date_local ?? '').slice(0, 10),
    name: raw.name ?? '',
  }
}

export class HttpIntervalsGateway implements IntervalsCalendarGateway {
  private readonly authorization: string
  private readonly athletePath: string
  private readonly baseUrl: string
  private readonly fetch: Fetch
  private readonly timeoutMs: number
  private readonly retries: number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(options: HttpIntervalsGatewayOptions) {
    if (!options.apiKey.trim()) throw new Error('INTERVALS_API_KEY is empty')
    // intervals.icu's Personal API takes the literal user name API_KEY with the key as the password.
    this.authorization = `Basic ${Buffer.from(`API_KEY:${options.apiKey.trim()}`).toString('base64')}`
    this.athletePath = `/athlete/${encodeURIComponent(options.athleteId?.trim() || '0')}`
    this.baseUrl = options.baseUrl ?? INTERVALS_API_BASE
    this.fetch = options.fetch ?? ((url, init) => fetch(url, init))
    this.timeoutMs = options.timeoutMs ?? 15_000
    this.retries = options.retries ?? 3
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  private async request(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${this.athletePath}${path}`)
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value)
    const label = `${method} ${url.pathname}`

    for (let attempt = 0; ; attempt += 1) {
      const last = attempt >= this.retries
      let response: Response
      try {
        response = await this.fetch(url.toString(), {
          method,
          headers: {
            Authorization: this.authorization,
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        })
      } catch (error) {
        if (last) throw new IntervalsApiError(`${label} failed: ${error instanceof Error ? error.message : String(error)}`, null)
        await this.sleep(1_000 * 2 ** attempt)
        continue
      }

      if (response.ok) {
        const text = await response.text()
        return text ? JSON.parse(text) : null
      }
      if (RETRYABLE(response.status) && !last) {
        const retryAfter = Number(response.headers.get('retry-after'))
        await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 1_000 * 2 ** attempt)
        continue
      }

      const detail = (await response.text().catch(() => '')).slice(0, 200)
      const text = `${label} answered HTTP ${response.status}${detail ? `: ${detail}` : ''}`
      if (response.status === 429) throw new IntervalsRateLimitError(text)
      if (response.status === 404) throw new IntervalsNotFoundError(text)
      if (response.status === 401 || response.status === 403) {
        throw new IntervalsApiError(`${text} - check INTERVALS_API_KEY and INTERVALS_ATHLETE_ID`, response.status)
      }
      throw new IntervalsApiError(text, response.status)
    }
  }

  async getEvent(eventId: string): Promise<IntervalsEventRecord | null> {
    try {
      return record((await this.request('GET', `/events/${encodeURIComponent(eventId)}`)) as RawEvent, 'a read')
    } catch (error) {
      if (error instanceof IntervalsNotFoundError) return null
      throw error
    }
  }

  /** Upserted on the external id, so a create retried after a lost answer updates rather than duplicates. */
  async createEvent(event: IntervalsWorkoutEvent): Promise<IntervalsEventRecord> {
    const answer = await this.request('POST', '/events/bulk', [event], { upsert: 'true' })
    return record(Array.isArray(answer) ? (answer[0] as RawEvent) : undefined, 'a create')
  }

  async updateEvent(eventId: string, event: IntervalsWorkoutEvent): Promise<IntervalsEventRecord> {
    return record((await this.request('PUT', `/events/${encodeURIComponent(eventId)}`, event)) as RawEvent, 'an update')
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.request('DELETE', `/events/${encodeURIComponent(eventId)}`)
  }

  async listWorkoutEvents(oldest: string, newest: string): Promise<IntervalsEventRecord[]> {
    const answer = await this.request('GET', '/events', undefined, { oldest, newest, category: 'WORKOUT' })
    return (Array.isArray(answer) ? (answer as RawEvent[]) : []).map((raw) => record(raw, 'a listing'))
  }
}
