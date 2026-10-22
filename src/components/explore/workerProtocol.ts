import type {
  AreaCoverage,
  ExploreAreaFile,
  ExploreAreaRef,
  RouteCandidate,
  RoutePreferences,
  ScoredRoute,
} from '@/domain/explore/types'

/**
 * The messages between the Explore engine (main thread) and its worker.
 *
 * Every request carries an `id` and is answered exactly once with the same
 * `id`, either `{ id, result }` or `{ id, error }`, so the engine can keep
 * several requests in flight and still hand each answer to its own caller.
 *
 * This module holds types and one pure helper only: the worker imports it,
 * and nothing it pulls in may reach the locale tables.
 */

export type LonLat = [number, number]

/**
 * How an area is named on both sides: id and version, so a rebuilt area file
 * is a different area and never mixes with results computed on the old one.
 */
export function areaKey(ref: Pick<ExploreAreaRef, 'id' | 'version'>): string {
  return `${ref.id}:${ref.version}`
}

/**
 * A run's place in a cluster's routes. `/api/map/routes` keys its tracks by
 * route index, which shifts with every new run; coverage keys them by
 * activity id, which never does. The answer names the run at each index, so
 * the worker only takes `routeIdx` where the two agree (`locateClusterTracks`).
 */
export interface ClusterTrackRef {
  routeIdx: number
  id: string
  /** 'YYYY-MM-DD', or an ISO timestamp (only its first 10 characters are kept). */
  date: string
}

/**
 * Many tracks in two flat buffers, so they cross to the worker by transfer
 * instead of as 200 000 small arrays to clone.
 */
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
  /** Count only these runs (the map's heat filters); undefined counts every run added to the area. */
  activityIds?: string[]
  /** For distances and the next quartier; null when unknown. */
  home: LonLat | null
  /**
   * With no `home`, use the median start of every run added to the area
   * (`medianStart`): a page that never loads the map can still rank the
   * next quartier, and the start points never leave the worker's memory.
   */
  homeFromTracks?: boolean
}

export interface ScoreRoutesRequest {
  candidates: RouteCandidate[]
  /** The distance asked for, in metres. */
  targetM: number
  prefs: RoutePreferences
}

/** No home: the start is worked out from the area file alone (see `routeStart` in the domain). */
export interface RouteStartRequest {
  unitId: string
}

export type ExploreRequestBody =
  | { type: 'loadArea'; ref: ExploreAreaRef }
  | ({ type: 'addTracks'; areaKey: string } & TrackBuffers)
  | { type: 'fetchClusterTracks'; areaKey: string; clusterId: string; index: ClusterTrackRef[] }
  | ({ type: 'coverage'; areaKey: string } & CoverageOptions)
  | ({ type: 'scoreRoutes'; areaKey: string } & ScoreRoutesRequest)
  | ({ type: 'routeStart'; areaKey: string } & RouteStartRequest)

export type ExploreRequestType = ExploreRequestBody['type']

export type ExploreRequest = ExploreRequestBody & { id: number }

export type RequestOf<K extends ExploreRequestType> = Extract<ExploreRequestBody, { type: K }>

/** Activity ids the worker took in; runs it already had, or without a track, are left out. */
export interface AddedTracks {
  added: string[]
}

/** What each request resolves to. */
export interface ExploreResults {
  /** The main thread needs the shapes for MapLibre. */
  loadArea: ExploreAreaFile
  addTracks: AddedTracks
  fetchClusterTracks: AddedTracks
  coverage: AreaCoverage
  /** Best first. */
  scoreRoutes: ScoredRoute[]
  /** See `routeStart` in the domain: a public point inside the unit, never home. */
  routeStart: LonLat | null
}

export type ExploreResponse =
  | { id: number; result: ExploreResults[ExploreRequestType] }
  | { id: number; error: string }
