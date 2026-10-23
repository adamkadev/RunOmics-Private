import type { RouteCandidate } from '@/domain/explore/types'

export interface RoundTripRequest {
  /**
   * [lon, lat] where the loop starts and ends: a public point inside the
   * target quartier, never home - the provider's terms forbid personal data,
   * and home is the one thing these routes would give away.
   */
  start: [number, number]
  /** The length asked for. A provider treats it as a wish, not a promise. */
  lengthM: number
  /** Same start, length and seed, same loop: the seed is the only way to ask for another. */
  seed: number
  /**
   * A hint an adapter may pass on. Route scoring penalises busy roads either
   * way, so an adapter that cannot ask for quiet streets loses nothing.
   */
  avoidBusyRoads: boolean
  /**
   * The caller has gone (the athlete asked for another distance): stop
   * waiting. The provider may well have counted the call already; nothing
   * more is asked of it after this.
   */
  signal?: AbortSignal
}

/**
 * Why a loop could not be had, coarse enough to choose an answer on and no
 * finer: the provider's own message stays in the server log.
 *
 * - `quota`: the day's allowance is spent.
 * - `rateLimit`: too many in the last minute; worth a retry shortly.
 * - `noRoute`: no loop from that start, say a point no path reaches.
 * - `upstream`: the provider failed or answered something unreadable.
 * - `timeout`: no answer in time.
 * - `unauthorized`: the provider refused our key - this server's
 *   configuration, never the caller's fault.
 */
export type RoutingErrorKind = 'quota' | 'rateLimit' | 'noRoute' | 'upstream' | 'timeout' | 'unauthorized'

export type RoundTripResult =
  | { ok: true; candidate: RouteCandidate }
  | { ok: false; kind: RoutingErrorKind }

/**
 * Round-trip routing for Explore's loop generator. A result rather than a
 * throw: one batch fans out several requests, and a failed one is an
 * ordinary outcome to weigh against the others, not an exception.
 */
export interface RoutingGateway {
  roundTrip(req: RoundTripRequest): Promise<RoundTripResult>
}
