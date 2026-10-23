import type { MultiPolygon, Polygon, Position } from 'geojson'
import {
  EXPLORE_SCHEMA,
  type ExploreAreaFile,
  type ExploreAreaRef,
  type ExploreIndexFile,
  type ExploreSource,
  type ExploreUnitFeature,
  type UnitKind,
} from './types'

/**
 * Area and index files sit in IndexedDB for months, so a hand-edited file, a
 * half-written cache entry or a later schema must fail here as one `null`
 * rather than as a NaN deep inside coverage. Nothing is repaired.
 */

/** Area ids name a file and a URL segment, so they stay this plain. */
export const AREA_ID_PATTERN = /^[a-z0-9-]{1,64}$/
/** An index entry's `file` is a bare name inside `explore/`: no path, no leading dot. */
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
/** Cell keys are non-negative integers below 2^32 (see `cellKey`). */
const MAX_CELL_KEY = 2 ** 32

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isLonLat(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  )
}

function isBBox(value: unknown): value is [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) return false
  const [minLon, minLat, maxLon, maxLat] = value as number[]
  return minLon! <= maxLon! && minLat! <= maxLat!
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 && value.every(isFiniteNumber)
}

/** A closed ring needs at least four positions (the first repeated last). */
function isRing(value: unknown): value is Position[] {
  return Array.isArray(value) && value.length >= 4 && value.every(isPosition)
}

function isRings(value: unknown): value is Position[][] {
  return Array.isArray(value) && value.length > 0 && value.every(isRing)
}

function isGeometry(value: unknown): value is Polygon | MultiPolygon {
  if (!isObject(value)) return false
  if (value.type === 'Polygon') return isRings(value.coordinates)
  if (value.type === 'MultiPolygon') {
    return Array.isArray(value.coordinates) && value.coordinates.length > 0 && value.coordinates.every(isRings)
  }
  return false
}

/** Strictly increasing non-negative integers: sorted and unique in one pass. */
function isRunnable(value: unknown): value is number[] {
  if (!Array.isArray(value)) return false
  let previous = -1
  for (const key of value) {
    if (!Number.isInteger(key) || key <= previous || key >= MAX_CELL_KEY) return false
    previous = key
  }
  return true
}

function isKind(value: unknown): value is UnitKind {
  return value === 'quartier' || value === 'commune'
}

function isSource(value: unknown): value is ExploreSource {
  return (
    isObject(value) &&
    isText(value.id) &&
    isText(value.label) &&
    typeof value.licence === 'string' &&
    typeof value.url === 'string' &&
    typeof value.version === 'string'
  )
}

function isFeature(value: unknown): value is ExploreUnitFeature {
  if (!isObject(value) || value.type !== 'Feature' || !isObject(value.properties)) return false
  const p = value.properties
  return (
    isText(p.id) &&
    value.id === p.id &&
    isText(p.name) &&
    isKind(p.kind) &&
    isText(p.commune) &&
    isLonLat(p.label) &&
    isRunnable(p.runnable) &&
    isGeometry(value.geometry)
  )
}

function isGrid(value: unknown): boolean {
  return isObject(value) && isLonLat(value.origin) && isFiniteNumber(value.cellM) && value.cellM > 0
}

/** The area file as built by `scripts/build-explore-areas.ts`, or null. */
export function parseAreaFile(json: unknown): ExploreAreaFile | null {
  if (!isObject(json) || json.type !== 'FeatureCollection') return null
  const meta = json.runomics
  if (
    !isObject(meta) ||
    meta.schema !== EXPLORE_SCHEMA ||
    typeof meta.id !== 'string' ||
    !AREA_ID_PATTERN.test(meta.id) ||
    !isText(meta.name) ||
    !isText(meta.version) ||
    typeof meta.generatedAt !== 'string' ||
    !isGrid(meta.grid) ||
    !isBBox(meta.bbox) ||
    !Array.isArray(meta.sources) ||
    !meta.sources.every(isSource)
  ) {
    return null
  }

  const features = json.features
  if (!Array.isArray(features) || !features.every(isFeature)) return null
  // Coverage keys its results by unit id, so two units sharing one would
  // silently merge.
  const ids = new Set(features.map((f) => f.properties.id))
  if (ids.size !== features.length) return null

  return json as unknown as ExploreAreaFile
}

function isIndexEntry(value: unknown): value is ExploreAreaRef & { file: string } {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    AREA_ID_PATTERN.test(value.id) &&
    isText(value.name) &&
    isText(value.version) &&
    isBBox(value.bbox) &&
    typeof value.file === 'string' &&
    FILE_NAME_PATTERN.test(value.file)
  )
}

/** `explore/index.json`, or null. */
export function parseIndexFile(json: unknown): ExploreIndexFile | null {
  if (!isObject(json) || json.schema !== EXPLORE_SCHEMA) return null
  const areas = json.areas
  if (!Array.isArray(areas) || !areas.every(isIndexEntry)) return null
  if (new Set(areas.map((a) => a.id)).size !== areas.length) return null
  return json as unknown as ExploreIndexFile
}
