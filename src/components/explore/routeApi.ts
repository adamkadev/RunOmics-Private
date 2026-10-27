import type { User } from 'firebase/auth'
import type { AvoidCircle } from '@/domain/explore/avoidSpots'
import type { RouteCandidate } from '@/domain/explore/types'
import { authorizedFetch } from '@/lib/ownerFetch'
import { reportClientError } from '@/lib/reportClientError'

// On a public site the route wants the owner's Firebase token; on a private site the session cookie is enough.

export const ROUTE_ENDPOINT = '/api/explore/route'

export interface RouteBatchRequest {
  /** [lon, lat]: the quartier's public start, or the point the runner tapped. */
  start: [number, number]
  distanceM: number
  seeds: number[]
  /** One list per seed: the way through the quartier from a start outside it. */
  vias?: [number, number][][]
  avoid?: AvoidCircle[]
}

export interface RouteBatch {
  candidates: RouteCandidate[]
  attribution: string
}

/**
 * - notConfigured: no routing key (or no owner auth) on this deployment;
 * - rateLimited / providerLimit: ours, or the provider's per-minute limit;
 * - invalid: the request itself was refused (a bug, worded as "try again").
 */
export type RouteFailure =
  | 'notConfigured'
  | 'auth'
  | 'rateLimited'
  | 'providerLimit'
  | 'dailyQuota'
  | 'noRoute'
  | 'invalid'
  | 'upstream'

export class RouteRequestError extends Error {
  readonly reason: RouteFailure
  /** Seconds to wait, when the answer says. */
  readonly retryAfter: number | null

  constructor(reason: RouteFailure, retryAfter: number | null = null) {
    super(`Route request failed: ${reason}`)
    this.name = 'RouteRequestError'
    this.reason = reason
    this.retryAfter = retryAfter
  }
}

const REASONS: ReadonlySet<string> = new Set(['notConfigured', 'rateLimited', 'providerLimit', 'dailyQuota', 'noRoute', 'invalid', 'upstream'])

export function routeFailure(status: number, body: unknown): RouteFailure {
  const reason = typeof body === 'object' && body !== null ? (body as { reason?: unknown }).reason : undefined
  if (typeof reason === 'string' && REASONS.has(reason)) return reason as RouteFailure
  if (status === 401 || status === 403) return 'auth'
  // The owner check answers 503 without a reason when Firebase auth isn't set up.
  if (status === 503) return 'notConfigured'
  if (status === 429) return 'rateLimited'
  if (status === 422) return 'noRoute'
  if (status === 400) return 'invalid'
  return 'upstream'
}

function retryAfterOf(res: Response, body: unknown): number | null {
  const fromBody = typeof body === 'object' && body !== null ? (body as { retryAfter?: unknown }).retryAfter : undefined
  if (typeof fromBody === 'number' && Number.isFinite(fromBody)) return fromBody
  const header = Number(res.headers.get('retry-after'))
  return Number.isFinite(header) && header > 0 ? header : null
}

function isCandidate(value: unknown): value is RouteCandidate {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Partial<RouteCandidate>
  return Array.isArray(c.coordinates) && c.coordinates.length >= 2 && typeof c.distanceM === 'number' && Array.isArray(c.waytypes)
}

export async function requestRouteBatch(
  request: RouteBatchRequest,
  { user, signal }: { user?: User | null; signal?: AbortSignal } = {},
): Promise<RouteBatch> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    cache: 'no-store',
    signal,
  }
  let res: Response
  try {
    res = user ? await authorizedFetch(user, ROUTE_ENDPOINT, init) : await fetch(ROUTE_ENDPOINT, init)
  } catch (err) {
    if (signal?.aborted) throw err
    // The request never reached the server, so no server log says why: the phone's own error is all there is.
    reportClientError('route-fetch', err)
    throw new RouteRequestError('upstream')
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new RouteRequestError(routeFailure(res.status, body), retryAfterOf(res, body))

  const candidates = (body as { candidates?: unknown } | null)?.candidates
  if (!Array.isArray(candidates)) throw new RouteRequestError('upstream')
  const loops = candidates.filter(isCandidate)
  if (loops.length === 0) throw new RouteRequestError('noRoute')
  const attribution = (body as { attribution?: unknown }).attribution
  return { candidates: loops, attribution: typeof attribution === 'string' ? attribution : '' }
}
