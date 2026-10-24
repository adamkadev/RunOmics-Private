import { NextResponse, type NextRequest } from 'next/server'
import type { RoutingErrorKind } from '@/application/ports/RoutingGateway'
import {
  createRoutingGateway,
  generateLoopRoutes,
  parseLoopRequest,
  routingConfig,
} from '@/application/usecases/GenerateLoopRoutes'
import { authorizeExploreCaller } from '@/lib/exploreAccess'
import { logRejectedRequest } from '@/lib/internalAuth'
import { createRateLimiter } from '@/lib/rateLimit'

/**
 * OpenRouteService is called with the server's key so no browser ever holds it, and its own message never leaves the
 * server: it can quote the start. Nothing here may be cached anywhere: a batch is one person's start point.
 */

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** The routes are CC BY-SA from ORS, over ODbL map data: shown wherever they are. */
const ATTRIBUTION = '© openrouteservice by HeiGIT | © OpenStreetMap contributors'

/** A batch is up to six loops, each perhaps asked for twice, against a provider limit of 40 a minute for the deployment. */
const limiter = createRateLimiter({ max: 12, windowMs: 60_000, maxKeys: 1000 })

/** ORS's per-minute window, for a client that should wait out the provider's limit. */
const PROVIDER_RETRY_AFTER_S = 60

const FAILURES: Record<RoutingErrorKind, { status: number; error: string; reason: string; retryAfter?: number }> = {
  quota: { status: 429, error: 'The route provider’s daily limit is used up', reason: 'dailyQuota' },
  rateLimit: { status: 429, error: 'The route provider is busy', reason: 'providerLimit', retryAfter: PROVIDER_RETRY_AFTER_S },
  noRoute: { status: 422, error: 'No loop found from this start', reason: 'noRoute' },
  upstream: { status: 502, error: 'The route provider failed', reason: 'upstream' },
  timeout: { status: 502, error: 'The route provider did not answer in time', reason: 'upstream' },
  // Our key, our configuration: the caller can do nothing about it but retry later.
  unauthorized: { status: 502, error: 'The route provider failed', reason: 'upstream' },
}

/** What was sent, never where: field names, counts and the distance, no coordinate. */
function requestShape(body: unknown): string {
  if (typeof body !== 'object' || body === null) return typeof body
  const { distanceM, seeds, vias } = body as Record<string, unknown>
  const lists = Array.isArray(vias) ? vias.map((list) => (Array.isArray(list) ? list.length : typeof list)).join(',') : typeof vias
  return `keys=${Object.keys(body).join(',')} distanceM=${typeof distanceM === 'number' ? Math.round(distanceM) : typeof distanceM} seeds=${Array.isArray(seeds) ? seeds.length : typeof seeds} vias=${lists}`
}

function answer(body: object, status: number, retryAfter?: number): NextResponse {
  const headers = retryAfter === undefined ? NO_STORE : { ...NO_STORE, 'retry-after': String(retryAfter) }
  return NextResponse.json(retryAfter === undefined ? body : { ...body, retryAfter }, { status, headers })
}

export async function POST(req: NextRequest) {
  try {
    const caller = await authorizeExploreCaller(req)
    if (!caller.ok) return caller.response

    const limit = limiter.take(caller.key, Date.now())
    if (!limit.ok) {
      logRejectedRequest(req, 'rate-limited')
      return answer({ error: 'Too many route requests', reason: 'rateLimited' }, 429, limit.retryAfterS)
    }

    const body: unknown = await req.json().catch(() => undefined)
    const request = parseLoopRequest(body)
    if (!request) {
      console.warn('[explore:route] refused a request shaped', requestShape(body))
      return answer({ error: 'Invalid route request', reason: 'invalid' }, 400)
    }

    const config = routingConfig(process.env)
    if ('missing' in config) {
      return answer({ error: `Route generation is not configured: ${config.missing.join(', ')} unset`, reason: 'notConfigured' }, 503)
    }
    if ('malformed' in config) {
      // Named, never quoted: the value is a secret.
      console.error(`[explore:route] ${config.malformed.join(', ')} holds a space, line break or control character`)
      return answer({ error: `Route generation is not configured: ${config.malformed.join(', ')} malformed`, reason: 'notConfigured' }, 503)
    }

    // A client that moved on (a new distance) aborts its request: the batch stops asking the provider.
    const result = await generateLoopRoutes(createRoutingGateway(config), request, { signal: req.signal })
    if (!result.ok) {
      if (result.kind === 'unauthorized') console.error('[explore:route] the route provider refuses ORS_API_KEY')
      const { status, error, reason, retryAfter } = FAILURES[result.kind]
      return answer({ error, reason }, status, retryAfter)
    }

    return answer({ candidates: result.candidates, attribution: ATTRIBUTION }, 200)
  } catch (error) {
    console.error('[explore:route]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: NO_STORE })
  }
}
