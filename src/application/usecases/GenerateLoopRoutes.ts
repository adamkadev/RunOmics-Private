import type { RoundTripResult, RoutingErrorKind, RoutingGateway } from '@/application/ports/RoutingGateway'
import type { RouteCandidate } from '@/domain/explore/types'
import { OpenRouteServiceGateway } from '@/infrastructure/routing/OpenRouteServiceGateway'

/**
 * Explore's loop generator: a batch of round trips from one start, one per
 * seed, for the client to score against the athlete's own coverage. Scoring
 * stays on the client because only the coverage worker knows which streets
 * are new; this side only fetches.
 */

export interface LoopRequest {
  /** [lon, lat]: a public point inside the target quartier, never home. */
  start: [number, number]
  /** The planned session's whole distance. */
  distanceM: number
  /** One loop per seed. A new batch is new seeds. */
  seeds: number[]
  avoidBusyRoads: boolean
}

export type LoopRoutesResult =
  | { ok: true; candidates: RouteCandidate[] }
  | { ok: false; kind: RoutingErrorKind }

export const LOOP_LIMITS = {
  minDistanceM: 1_000,
  // A marathon. ORS itself stops at 100 km, and the retry below can ask for twice this.
  maxDistanceM: 42_000,
  maxSeeds: 6,
} as const

/** Further off the target than this, a loop is asked for once more. */
const MAX_DRIFT = 0.15
/** How far the retry may stretch or shrink its ask, so one wild loop cannot make a wilder request. */
const MAX_CORRECTION = 2

/**
 * What a batch that found nothing answers with, worst first: a spent quota
 * or a rate limit says when to try again, a refused key is ours to fix, and
 * "no loop from here" only means try another start - so it loses to every
 * other reason for the batch failing.
 */
const SEVERITY: RoutingErrorKind[] = ['quota', 'rateLimit', 'unauthorized', 'upstream', 'timeout', 'noRoute']

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/**
 * A request body as JSON parsed it, checked whole: anything else is a 400.
 * Repeated seeds are folded together rather than refused - each would spend
 * a request on a loop already in the batch.
 */
export function parseLoopRequest(body: unknown): LoopRequest | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const { start, distanceM, seeds, avoidBusyRoads } = body as Record<string, unknown>

  if (!Array.isArray(start) || start.length !== 2) return null
  const [lon, lat] = start as unknown[]
  if (!finite(lon) || !finite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null

  if (!finite(distanceM) || distanceM < LOOP_LIMITS.minDistanceM || distanceM > LOOP_LIMITS.maxDistanceM) return null

  if (!Array.isArray(seeds) || seeds.length < 1 || seeds.length > LOOP_LIMITS.maxSeeds) return null
  if (!seeds.every((seed) => Number.isSafeInteger(seed))) return null

  if (avoidBusyRoads !== undefined && typeof avoidBusyRoads !== 'boolean') return null

  return { start: [lon, lat], distanceM, seeds: [...new Set(seeds as number[])], avoidBusyRoads: avoidBusyRoads ?? false }
}

/**
 * A key is one run of visible ASCII. Anything else (a line break from two
 * keys pasted into a multi-line field, a NUL, a space) cannot travel in a
 * header: fetch refuses it with an error that quotes the whole value, and
 * that error would land in a log. So such a key counts as no key.
 */
const PLAIN_KEY = /^[\x21-\x7E]+$/

export type RoutingConfig = { apiKey: string } | { missing: string[] } | { malformed: string[] }

export function routingConfig(env: Readonly<Record<string, string | undefined>>): RoutingConfig {
  const apiKey = env.ORS_API_KEY?.trim()
  if (!apiKey) return { missing: ['ORS_API_KEY'] }
  return PLAIN_KEY.test(apiKey) ? { apiKey } : { malformed: ['ORS_API_KEY'] }
}

/** The one place that knows the provider: routes reach it through here, never through src/infrastructure. */
export function createRoutingGateway(config: { apiKey: string }): RoutingGateway {
  return new OpenRouteServiceGateway(config.apiKey)
}

const drift = (distanceM: number, targetM: number) => Math.abs(distanceM - targetM) / targetM

/**
 * One seed's loop. A round trip's length is a wish - a loop that crosses a
 * river comes back far longer - so a loop too far off is asked for again
 * with the length scaled by how far it missed, same seed, and the closer of
 * the two kept. Once: a second miss is the network, not the arithmetic.
 */
async function loopFor(gateway: RoutingGateway, request: LoopRequest, seed: number): Promise<RoundTripResult> {
  const { start, distanceM: target, avoidBusyRoads } = request
  const first = await gateway.roundTrip({ start, lengthM: target, seed, avoidBusyRoads })
  if (!first.ok || drift(first.candidate.distanceM, target) <= MAX_DRIFT) return first

  const correction = Math.min(MAX_CORRECTION, Math.max(1 / MAX_CORRECTION, target / first.candidate.distanceM))
  const second = await gateway.roundTrip({ start, lengthM: target * correction, seed, avoidBusyRoads })
  if (!second.ok) return first
  return drift(second.candidate.distanceM, target) < drift(first.candidate.distanceM, target) ? second : first
}

/**
 * Every seed at once. Any loop found makes the batch a success - the client
 * scores what it has - and only a batch with nothing answers with a reason.
 */
export async function generateLoopRoutes(gateway: RoutingGateway, request: LoopRequest): Promise<LoopRoutesResult> {
  const settled = await Promise.allSettled(request.seeds.map((seed) => loopFor(gateway, request, seed)))

  const candidates: RouteCandidate[] = []
  const failures = new Set<RoutingErrorKind>()
  for (const outcome of settled) {
    if (outcome.status === 'rejected') {
      // A gateway answers with a result; one that throws has a bug, and the caller sees a provider failure.
      console.error('[explore] a round trip threw', outcome.reason)
      failures.add('upstream')
    } else if (outcome.value.ok) {
      candidates.push(outcome.value.candidate)
    } else {
      failures.add(outcome.value.kind)
    }
  }

  if (candidates.length > 0) return { ok: true, candidates }
  return { ok: false, kind: SEVERITY.find((kind) => failures.has(kind)) ?? 'upstream' }
}
