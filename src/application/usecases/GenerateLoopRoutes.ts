import type { RoundTripResult, RoutingErrorKind, RoutingGateway } from '@/application/ports/RoutingGateway'
import { AVOID_LIMITS, isAvoidCircle, type AvoidCircle } from '@/domain/explore/avoidSpots'
import type { RouteCandidate } from '@/domain/explore/types'
import { OpenRouteServiceGateway } from '@/infrastructure/routing/OpenRouteServiceGateway'
import { distanceKm } from '@/lib/math'

/** Scoring stays on the client, where the coverage worker knows which streets are new: this side only fetches. */

export interface LoopRequest {
  /** [lon, lat]: the quartier's public start, or the point the runner tapped. */
  start: [number, number]
  distanceM: number
  /** One loop per seed. A new batch is new seeds. */
  seeds: number[]
  /** `vias[k]` is the way through the quartier for `seeds[k]`. */
  vias?: [number, number][][]
  avoid?: AvoidCircle[]
}

export type LoopRoutesResult =
  | { ok: true; candidates: RouteCandidate[] }
  | { ok: false; kind: RoutingErrorKind }

export const LOOP_LIMITS = {
  minDistanceM: 1_000,
  // A marathon. ORS itself stops at 100 km, and the retry below can ask for twice this.
  maxDistanceM: 42_000,
  maxSeeds: 6,
  maxVias: 3,
} as const

/** Further off the target than this, a loop is asked for once more. */
const MAX_DRIFT = 0.15
/** How far the retry may stretch or shrink its ask, so one wild loop cannot make a wilder request. */
const MAX_CORRECTION = 2

/** Worst first: "no loop from here" only means try another start, so it loses to every other reason. */
const SEVERITY: RoutingErrorKind[] = ['quota', 'rateLimit', 'unauthorized', 'upstream', 'timeout', 'noRoute']

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function lonLat(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const [lon, lat] = value as unknown[]
  return finite(lon) && finite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 ? [lon, lat] : null
}

function tourM(stops: readonly [number, number][]): number {
  return stops.reduce((sum, [lon, lat], k) => {
    const [nextLon, nextLat] = stops[(k + 1) % stops.length]!
    return sum + distanceKm(lon, lat, nextLon, nextLat) * 1000
  }, 0)
}

/** One list per seed; a tour longer than the longest loop allowed is refused before it costs a request. */
function parseVias(value: unknown, start: [number, number], seedCount: number): [number, number][][] | null {
  if (!Array.isArray(value) || value.length !== seedCount) return null
  const lists: [number, number][][] = []
  for (const list of value) {
    if (!Array.isArray(list) || list.length < 1 || list.length > LOOP_LIMITS.maxVias) return null
    const points = list.map(lonLat)
    if (!points.every((point) => point !== null)) return null
    if (tourM([start, ...points]) > LOOP_LIMITS.maxDistanceM) return null
    lists.push(points)
  }
  return lists
}

/** Repeated seeds are folded together rather than refused: each would spend a request on a loop already in the batch. */
export function parseLoopRequest(body: unknown): LoopRequest | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const { start: rawStart, distanceM, seeds, vias: rawVias, avoid } = body as Record<string, unknown>

  const start = lonLat(rawStart)
  if (!start) return null

  if (!finite(distanceM) || distanceM < LOOP_LIMITS.minDistanceM || distanceM > LOOP_LIMITS.maxDistanceM) return null

  if (!Array.isArray(seeds) || seeds.length < 1 || seeds.length > LOOP_LIMITS.maxSeeds) return null
  if (!seeds.every((seed) => Number.isSafeInteger(seed))) return null

  const vias = rawVias === undefined ? undefined : parseVias(rawVias, start, seeds.length)
  if (vias === null) return null

  if (avoid !== undefined && (!Array.isArray(avoid) || avoid.length > AVOID_LIMITS.perRequest || !avoid.every(isAvoidCircle))) return null

  const first = (seeds as number[]).flatMap((seed, k) => (seeds.indexOf(seed) === k ? [k] : []))
  return {
    start,
    distanceM,
    seeds: first.map((k) => seeds[k] as number),
    ...(vias ? { vias: first.map((k) => vias[k]!) } : {}),
    ...(avoid?.length ? { avoid: avoid.map(([lon, lat, radiusM]): AvoidCircle => [lon, lat, radiusM]) } : {}),
  }
}

/**
 * Visible ASCII only: anything else cannot travel in a header, and fetch's error quotes the whole value,
 * which would land in a log. Such a key counts as no key.
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
 * A round trip's length is a wish, so a loop too far off is asked for once more, scaled by its miss,
 * and the closer kept. Only once: a second miss is the network, not the arithmetic.
 */
async function loopFor(
  gateway: RoutingGateway,
  request: LoopRequest,
  seed: number,
  vias: [number, number][] | undefined,
  signal: AbortSignal | undefined,
): Promise<RoundTripResult> {
  const { start, distanceM: target, avoid } = request
  if (signal?.aborted) return { ok: false, kind: 'upstream' }
  const first = await gateway.roundTrip({ start, lengthM: target, seed, avoid, signal, ...(vias ? { vias } : {}) })
  // A tour's length is set by its vias: asking again would bring the same loop.
  if (vias || !first.ok || drift(first.candidate.distanceM, target) <= MAX_DRIFT || signal?.aborted) return first

  const correction = Math.min(MAX_CORRECTION, Math.max(1 / MAX_CORRECTION, target / first.candidate.distanceM))
  const second = await gateway.roundTrip({ start, lengthM: target * correction, seed, avoid, signal })
  if (!second.ok) return first
  return drift(second.candidate.distanceM, target) < drift(first.candidate.distanceM, target) ? second : first
}

/** Any loop found makes the batch a success; once `signal` aborts, nothing more goes to the provider for this batch. */
export async function generateLoopRoutes(
  gateway: RoutingGateway,
  request: LoopRequest,
  { signal }: { signal?: AbortSignal } = {},
): Promise<LoopRoutesResult> {
  const settled = await Promise.allSettled(request.seeds.map((seed, k) => loopFor(gateway, request, seed, request.vias?.[k], signal)))

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
