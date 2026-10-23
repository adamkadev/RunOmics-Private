import 'server-only'
import type {
  RoundTripRequest,
  RoundTripResult,
  RoutingErrorKind,
  RoutingGateway,
} from '@/application/ports/RoutingGateway'
import type { RouteCandidate } from '@/domain/explore/types'

/**
 * Explore's loops from OpenRouteService (HeiGIT), the one free provider that
 * makes round trips: `options.round_trip` on the foot-walking profile, one
 * request per loop, the seed choosing which.
 *
 * Server-side only, by the provider's terms as much as by the CSP: an ORS key
 * belongs to one person and must never reach a browser. The free Standard
 * plan allows 2000 directions a day and 40 a minute.
 *
 * `avoidBusyRoads` is not sent. ORS's `quiet` weighting has not been tried
 * together with `round_trip`, and a combination it refuses would fail every
 * loop the moment the toggle is on; route scoring penalises state roads and
 * roads from the `waytype` extra instead.
 */

export const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson'

const CALL_TIMEOUT_MS = 10_000
const LOG_BODY_LIMIT = 300

/** 2009: no route between the points. 2010: no routable point near a coordinate. */
const NO_ROUTE_CODES = new Set([2009, 2010])
const NO_ROUTE_MESSAGE = /route could not be found|could not find routable point|unable to find a route/i

function requestBody({ start, lengthM, seed }: RoundTripRequest) {
  return {
    coordinates: [start],
    elevation: true,
    instructions: false,
    preference: 'recommended',
    units: 'm',
    extra_info: ['waytype', 'noise'],
    options: {
      round_trip: { length: Math.round(lengthM), points: 4, seed },
      avoid_features: ['ferries', 'fords'],
    },
  }
}

function isTimeout(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name
  return name === 'TimeoutError' || name === 'AbortError'
}

/**
 * An error body is only ever logged, and trimmed and stripped of every
 * decimal number first: ORS quotes the coordinates it could not route from,
 * and a server log is no place for where an athlete runs.
 */
function forLog(text: string): string {
  return text.replace(/-?\d+\.\d+/g, '#').slice(0, LOG_BODY_LIMIT)
}

/** ORS errors read `{ error: { code, message } }`; its gateway's own read `{ error: "…" }`. */
function orsError(text: string): { code: number | null; message: string } {
  try {
    const error = (JSON.parse(text) as { error?: unknown } | null)?.error
    if (typeof error === 'string') return { code: null, message: error }
    if (error && typeof error === 'object') {
      const { code, message } = error as { code?: unknown; message?: unknown }
      return { code: typeof code === 'number' ? code : null, message: typeof message === 'string' ? message : '' }
    }
  } catch {
    // Not JSON: a proxy's error page. The text is the message.
  }
  return { code: null, message: text }
}

/**
 * ORS's gateway (Tyk) answers two different things with a 403: a spent daily
 * allowance ("Quota exceeded") and a key it does not accept ("Access to this
 * API has been disallowed", what a wrong or revoked key gets), while 401
 * only means no key was sent at all. Only the first is the athlete's to wait
 * out; any other 403 is our key, for the owner to fix.
 */
const QUOTA_MESSAGE = /quota/i

function failureKind(status: number, text: string): RoutingErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 403) return QUOTA_MESSAGE.test(orsError(text).message) ? 'quota' : 'unauthorized'
  // The per-minute limit.
  if (status === 429) return 'rateLimit'
  if (status === 400 || status === 404) {
    const { code, message } = orsError(text)
    if ((code !== null && NO_ROUTE_CODES.has(code)) || NO_ROUTE_MESSAGE.test(message)) return 'noRoute'
  }
  // Any other 4xx is a request this adapter got wrong: the provider's failure as far as the caller can tell.
  return 'upstream'
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const numberOr = <T>(value: unknown, fallback: T): number | T => (finite(value) ? value : fallback)

interface OrsProperties {
  summary?: { distance?: unknown; duration?: unknown }
  distance?: unknown
  duration?: unknown
  ascent?: unknown
  descent?: unknown
  extras?: { waytype?: { values?: unknown } }
}

/**
 * The first feature of a GeoJSON answer, read field by field: an answer that
 * moves a field, or drops one, costs that field and not the whole loop.
 * Only the line and its length are required.
 */
export function parseCandidate(json: unknown, seed: number): RouteCandidate | null {
  const feature = (json as { features?: unknown } | null)?.features
  const first = Array.isArray(feature) ? (feature[0] as { geometry?: { coordinates?: unknown }; properties?: OrsProperties } | undefined) : undefined
  const line = first?.geometry?.coordinates
  if (!Array.isArray(line) || line.length < 2) return null

  const coordinates: number[][] = []
  for (const point of line) {
    if (!Array.isArray(point) || point.length < 2 || point.length > 3 || !point.every(finite)) return null
    coordinates.push([...point])
  }

  const props: OrsProperties = first?.properties ?? {}
  const distanceM = numberOr(props.summary?.distance, numberOr(props.distance, null))
  if (distanceM === null || distanceM <= 0) return null

  const ranges = props.extras?.waytype?.values
  const waytypes = (Array.isArray(ranges) ? ranges : []).filter(
    (range): range is [number, number, number] =>
      Array.isArray(range) &&
      range.length === 3 &&
      range.every(Number.isInteger) &&
      range[0] >= 0 &&
      range[0] <= range[1] &&
      range[1] < coordinates.length,
  )

  return {
    seed,
    coordinates,
    distanceM,
    // A walking time: nothing a runner reads, so a missing one is no reason to drop the loop.
    durationS: numberOr(props.summary?.duration, numberOr(props.duration, 0)),
    ascentM: numberOr(props.ascent, null),
    descentM: numberOr(props.descent, null),
    waytypes: waytypes.map(([from, to, value]) => [from, to, value]),
  }
}

export class OpenRouteServiceGateway implements RoutingGateway {
  constructor(private readonly apiKey: string) {}

  async roundTrip(req: RoundTripRequest): Promise<RoundTripResult> {
    let response: Response
    try {
      response = await fetch(ORS_DIRECTIONS_URL, {
        method: 'POST',
        headers: {
          // The bare key: ORS takes no "Bearer" scheme.
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/geo+json',
        },
        body: JSON.stringify(requestBody(req)),
        // The call's own time limit, and the caller leaving: whichever comes first.
        signal: req.signal ? AbortSignal.any([req.signal, AbortSignal.timeout(CALL_TIMEOUT_MS)]) : AbortSignal.timeout(CALL_TIMEOUT_MS),
        cache: 'no-store',
      })
    } catch (error) {
      return this.failed(error, req.signal)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const kind = failureKind(response.status, text)
      if (kind === 'unauthorized') {
        console.error(`[explore] openrouteservice refused the key (${response.status}): check ORS_API_KEY`, this.logSafe(text))
      } else {
        console.error('[explore] openrouteservice said', response.status, this.logSafe(text))
      }
      return { ok: false, kind }
    }

    let json: unknown
    try {
      json = await response.json()
    } catch (error) {
      // The timeout covers the body too, and a cut-off body is not JSON.
      return this.failed(error, req.signal)
    }

    const candidate = parseCandidate(json, req.seed)
    if (!candidate) {
      console.error('[explore] openrouteservice answered without a usable route')
      return { ok: false, kind: 'upstream' }
    }
    return { ok: true, candidate }
  }

  private failed(error: unknown, caller: AbortSignal | undefined): RoundTripResult {
    // The caller left: no one to answer, nothing wrong with the provider.
    if (caller?.aborted) return { ok: false, kind: 'upstream' }
    if (isTimeout(error)) {
      console.error(`[explore] openrouteservice gave no answer within ${CALL_TIMEOUT_MS / 1000} s`)
      return { ok: false, kind: 'timeout' }
    }
    console.error('[explore] openrouteservice unreachable:', this.logSafe(error instanceof Error ? `${error.name}: ${error.message}` : String(error)))
    return { ok: false, kind: 'upstream' }
  }

  /**
   * `forLog`, with the key cut out first. fetch quotes a header value it
   * refuses ("Headers.append: "…" is an invalid header value") in its error,
   * and this log is written here, past the redaction instrumentation applies
   * to errors a request throws. `routingConfig` refuses such a key already;
   * this is the second lock.
   */
  private logSafe(text: string): string {
    return forLog(this.apiKey ? text.split(this.apiKey).join('[ORS_API_KEY]') : text)
  }
}
