import type { MultiPolygon, Polygon } from 'geojson'
import type { GridSpec } from './grid'

/**
 * An area is the set of units (quartiers of the home city, whole communes around
 * it) built offline by `scripts/build-explore-areas.ts` into the data repo as
 * `explore/<id>.geojson`, listed in `explore/index.json`.
 */

export const EXPLORE_SCHEMA = 1

export const COMPLETE_PCT = 90
export const FOG_PCT = 15

export type UnitKind = 'quartier' | 'commune'

export interface ExploreSource {
  /** e.g. 'osm-admin10', 'metz-wfs', 'ign-iris', 'ign-commune', 'osm-runnable' */
  id: string
  /** Credit line, e.g. "Ville de Metz / Eurométropole de Metz – Quartiers". */
  label: string
  /** e.g. 'ODbL 1.0', 'Licence Ouverte 2.0' */
  licence: string
  url: string
  /** The source's own date or edition, e.g. '2026-03-24'. */
  version: string
}

export interface ExploreUnitProperties {
  /** Stable across rebuilds of the same source, e.g. 'metz-5746332', 'insee-57049'. */
  id: string
  /** Display name, e.g. "Nouvelle Ville", "Le Ban-Saint-Martin". */
  name: string
  kind: UnitKind
  /** The commune it belongs to (itself for a commune unit), e.g. "Metz". */
  commune: string
  /** Where its name is drawn and distances are measured from: [lon, lat], inside the shape. */
  label: [number, number]
  /**
   * The denominator: sorted `cellKey`s of the cells whose centre lies in this
   * unit and that hold a runnable OSM way, so rivers, rail and pathless woods
   * never count as unexplored.
   */
  runnable: number[]
}

export interface ExploreUnitFeature {
  type: 'Feature'
  id: string
  properties: ExploreUnitProperties
  /** Simplified to about 5 m, [lon, lat] with 6 decimals. */
  geometry: Polygon | MultiPolygon
}

/** The `runomics` foreign member of an area file. */
export interface ExploreAreaMeta {
  schema: typeof EXPLORE_SCHEMA
  id: string
  name: string
  /** Changes whenever the content does; cache keys use it. */
  version: string
  /** ISO date the file was built. */
  generatedAt: string
  grid: GridSpec
  /** [minLon, minLat, maxLon, maxLat] over every unit. */
  bbox: [number, number, number, number]
  sources: ExploreSource[]
}

export interface ExploreAreaFile {
  type: 'FeatureCollection'
  runomics: ExploreAreaMeta
  features: ExploreUnitFeature[]
}

/** One row of `explore/index.json`. Small enough to pass to client components. */
export interface ExploreAreaRef {
  id: string
  name: string
  version: string
  bbox: [number, number, number, number]
}

export interface ExploreIndexFile {
  schema: typeof EXPLORE_SCHEMA
  areas: (ExploreAreaRef & { file: string })[]
}

export type UnitState = 'complete' | 'partly' | 'fog'

export interface UnitCoverage {
  id: string
  name: string
  kind: UnitKind
  commune: string
  label: [number, number]
  /** Runnable cells visited by at least one run. */
  visited: number
  /** Runnable cells in the unit. */
  total: number
  /** floor(100 · visited / total), so the label and the state always agree. */
  pct: number
  state: UnitState
  /** Kilometres run inside the unit (each step counted where its midpoint falls). */
  kmRun: number
  /** 'YYYY-MM-DD' of the latest run that visited one of its cells, or null. */
  lastRunDate: string | null
  /** From home to `label`, or null when home is unknown. */
  distanceKm: number | null
}

export interface AreaCoverage {
  areaId: string
  version: string
  units: UnitCoverage[]
  /** floor(100 · Σvisited / Σtotal). */
  exploredPct: number
  completeCount: number
  /** Units with at least one runnable cell; the M in "N of M quartiers complete". */
  unitCount: number
  nextId: string | null
  home: [number, number] | null
}

/** A loop as the routing proxy returns it. */
export interface RouteCandidate {
  seed: number
  /** [lon, lat] or [lon, lat, ele] */
  coordinates: number[][]
  distanceM: number
  durationS: number
  ascentM: number | null
  descentM: number | null
  /**
   * ORS `waytype` ranges: [fromIndex, toIndex, value] into `coordinates`.
   * 1 state road, 2 road, 3 street, 4 path, 5 track, 6 cycleway, 7 footway,
   * 8 steps, 0 unknown.
   */
  waytypes: [number, number, number][]
  /** ORS `surface` ranges, as `waytypes`: 0 unknown, 2 unpaved, 3 asphalt, 11 dirt, 12 ground or mud, 17 grass. */
  surfaces?: [number, number, number][]
  /** ORS `steepness` ranges, as `waytypes`: −5 to 5, where 3 is a 7-10 % climb, 4 a 10-16 % one and 5 steeper. */
  steepness?: [number, number, number][]
}

export interface RoutePreferences {
  avoidBusyRoads: boolean
  newStreetsFirst: boolean
  /** Reps want flat ground and no crossings: on by itself on a quality day. */
  flatForReps: boolean
}

export interface ScoredRoute {
  candidate: RouteCandidate
  score: number
  /** Share of the route's length in cells no run has visited, 0–1. */
  newShare: number
  /** Share of the route's length on state roads and roads, 0–1. */
  busyShare: number
  /** Share of the route's length on trails, soft ground or steps, 0–1. */
  trailShare: number
  /** Metres of the route climbing at 10 % or more. */
  steepClimbM: number
  /**
   * One flag per coordinate step (length coordinates - 1): true when the
   * step lies in new ground, for drawing new (accent) vs known streets.
   */
  newSteps: boolean[]
}
