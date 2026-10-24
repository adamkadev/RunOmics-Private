import type { RoutePlan } from '@/domain/explore/routePlan'
import type {
  AreaCoverage,
  ExploreAreaFile,
  ExploreAreaRef,
  RouteCandidate,
  RoutePreferences,
  ScoredRoute,
} from '@/domain/explore/types'

/**
 * Every request is answered exactly once with its own `id`, so several can be in flight.
 * Types and one pure helper only: the worker imports this, and nothing it pulls in may reach the locale tables.
 */

export type LonLat = [number, number]

/** The version is part of it, so a rebuilt area never mixes with results computed on the old one. */
export function areaKey(ref: Pick<ExploreAreaRef, 'id' | 'version'>): string {
  return `${ref.id}:${ref.version}`
}

/** `/api/map/routes` keys its tracks by route index, which shifts with every new run; the activity id never does. */
export interface ClusterTrackRef {
  routeIdx: number
  id: string
  /** 'YYYY-MM-DD', or an ISO timestamp (only its first 10 characters are kept). */
  date: string
}

/** Two flat buffers, so the tracks cross to the worker by transfer instead of as 200 000 small arrays to clone. */
export interface TrackBuffers {
  ids: string[]
  /** 'YYYY-MM-DD', one per id. */
  dates: string[]
  /**
   * `ids.length + 1` point indices: track k is points `offsets[k]` up to
   * (not including) `offsets[k + 1]`, i.e. `coords[2·offsets[k] … 2·offsets[k+1])`.
   */
  offsets: Uint32Array
  /** [lon, lat, lon, lat, …] of every track, one after the other. */
  coords: Float64Array
}

export interface CoverageOptions {
  /** undefined counts every run added to the area. */
  activityIds?: string[]
  home: LonLat | null
  /** With no `home`, the median start of the runs counted, so the start points never leave the worker's memory. */
  homeFromTracks?: boolean
}

export interface ScoreRoutesRequest {
  candidates: RouteCandidate[]
  targetM: number
  prefs: RoutePreferences
}

/** No home: the start is worked out from the area file alone. */
export interface RouteStartRequest {
  unitId: string
}

/** Home comes in as for coverage: the plan picks no via near it. */
export interface RoutePlanRequest {
  unitId: string
  origin: LonLat
  home: LonLat | null
  homeFromTracks?: boolean
  distanceM: number
  seeds: number[]
}

export type ExploreRequestBody =
  | { type: 'loadArea'; ref: ExploreAreaRef }
  | ({ type: 'addTracks'; areaKey: string } & TrackBuffers)
  | { type: 'fetchClusterTracks'; areaKey: string; clusterId: string; index: ClusterTrackRef[] }
  | ({ type: 'coverage'; areaKey: string } & CoverageOptions)
  | ({ type: 'scoreRoutes'; areaKey: string } & ScoreRoutesRequest)
  | ({ type: 'routeStart'; areaKey: string } & RouteStartRequest)
  | ({ type: 'routePlan'; areaKey: string } & RoutePlanRequest)

export type ExploreRequestType = ExploreRequestBody['type']

export type ExploreRequest = ExploreRequestBody & { id: number }

export type RequestOf<K extends ExploreRequestType> = Extract<ExploreRequestBody, { type: K }>

/** Activity ids the worker took in; runs it already had, or without a track, are left out. */
export interface AddedTracks {
  added: string[]
}

export interface ExploreResults {
  /** The main thread needs the shapes for MapLibre. */
  loadArea: ExploreAreaFile
  addTracks: AddedTracks
  fetchClusterTracks: AddedTracks
  coverage: AreaCoverage
  /** Best first. */
  scoreRoutes: ScoredRoute[]
  /** A public point inside the unit, never home. */
  routeStart: LonLat | null
  routePlan: RoutePlan | null
}

export type ExploreResponse =
  | { id: number; result: ExploreResults[ExploreRequestType] }
  | { id: number; error: string }
