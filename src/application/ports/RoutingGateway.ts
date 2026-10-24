import type { RouteCandidate } from '@/domain/explore/types'

export interface RoundTripRequest {
  /** [lon, lat] where the loop starts and ends: the quartier's public start, or the point the runner tapped. */
  start: [number, number]
  /** Points the loop passes through in order; with none the provider draws a loop of `lengthM` itself. */
  vias?: [number, number][]
  /** A provider treats it as a wish, not a promise. */
  lengthM: number
  /** Same start, length and seed, same loop: the seed is the only way to ask for another. */
  seed: number
  /** A hint only: route scoring penalises busy roads either way. */
  avoidBusyRoads: boolean
  /** The caller has gone: stop waiting. The provider may already have counted the call. */
  signal?: AbortSignal
}

/**
 * Coarse on purpose: the provider's own message stays in the server log. `rateLimit` is worth a retry
 * shortly; `unauthorized` is this server's key, never the caller's fault.
 */
export type RoutingErrorKind = 'quota' | 'rateLimit' | 'noRoute' | 'upstream' | 'timeout' | 'unauthorized'

export type RoundTripResult =
  | { ok: true; candidate: RouteCandidate }
  | { ok: false; kind: RoutingErrorKind }

/** A result rather than a throw: in a batch of requests a failed one is an ordinary outcome. */
export interface RoutingGateway {
  roundTrip(req: RoundTripRequest): Promise<RoundTripResult>
}
