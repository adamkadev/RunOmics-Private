import { createHash } from 'node:crypto'
import type { MultiPolygon, Polygon } from 'geojson'
import { geometryBBox, type BBox } from '@/domain/explore/geometry'
import type { GridSpec } from '@/domain/explore/grid'
import {
  EXPLORE_SCHEMA,
  type ExploreAreaFile,
  type ExploreAreaRef,
  type ExploreIndexFile,
  type ExploreSource,
  type ExploreUnitFeature,
  type UnitKind,
} from '@/domain/explore/types'
import { round6 } from './simplify'

/**
 * The area file and its index row, built so the same sources always give
 * the same bytes: units in a fixed order, ids taken from the sources' own
 * stable ids, and a version that is a hash of everything else. A rebuild
 * that changes nothing keeps its version, so no phone downloads it again.
 */

/** 'Le Ban-Saint-Martin' -> 'le-ban-saint-martin'. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Quartiers from a city's own data, by the source's feature id: 'metz-5746332'. */
export const cityUnitId = (areaId: string, sourceId: string) => `${areaId}-${sourceId}`
/** A whole commune, by INSEE code: 'insee-57049'. */
export const communeUnitId = (insee: string) => `insee-${insee}`
/** An IRIS, by its 9-digit code: 'iris-574630101'. */
export const irisUnitId = (codeIris: string) => `iris-${codeIris}`
/** An OSM boundary relation: 'osm-r123'. */
export const osmUnitId = (relationId: number) => `osm-r${relationId}`

export interface UnitInput {
  id: string
  name: string
  kind: UnitKind
  commune: string
  label: [number, number]
  runnable: number[]
  /** Already simplified and rounded. */
  geometry: Polygon | MultiPolygon
}

const KIND_ORDER: Record<UnitKind, number> = { quartier: 0, commune: 1 }

/** Quartiers of the city first, then the communes around it, each by name as French sorts it. */
export function sortUnits<T extends Pick<UnitInput, 'id' | 'name' | 'kind'>>(units: readonly T[]): T[] {
  return [...units].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id),
  )
}

export interface AreaInput {
  id: string
  name: string
  /** 'YYYY-MM-DD'. A date, not a time, so a same-day rebuild keeps its version. */
  generatedAt: string
  grid: GridSpec
  sources: ExploreSource[]
  units: UnitInput[]
}

function areaBBox(units: readonly UnitInput[]): [number, number, number, number] {
  const [minLon, minLat, maxLon, maxLat] = units
    .map((unit) => geometryBBox(unit.geometry))
    .reduce<BBox>(
      (box, [a, b, c, d]) => [Math.min(box[0], a), Math.min(box[1], b), Math.max(box[2], c), Math.max(box[3], d)],
      [Infinity, Infinity, -Infinity, -Infinity],
    )
  return [round6(minLon), round6(minLat), round6(maxLon), round6(maxLat)]
}

/** `<id>-<YYYYMMDD>-<first 8 hex of the sha256 of the file with an empty version>`. */
export function areaVersion(file: ExploreAreaFile): string {
  const unversioned: ExploreAreaFile = { ...file, runomics: { ...file.runomics, version: '' } }
  const hash = createHash('sha256').update(JSON.stringify(unversioned)).digest('hex').slice(0, 8)
  return `${file.runomics.id}-${file.runomics.generatedAt.replaceAll('-', '')}-${hash}`
}

export function buildAreaFile(input: AreaInput): ExploreAreaFile {
  if (input.units.length === 0) throw new Error('An area needs at least one unit')
  const ids = new Set<string>()
  for (const unit of input.units) {
    if (ids.has(unit.id)) throw new Error(`Two units share the id ${unit.id}`)
    ids.add(unit.id)
  }

  const features: ExploreUnitFeature[] = sortUnits(input.units).map((unit) => ({
    type: 'Feature',
    id: unit.id,
    properties: {
      id: unit.id,
      name: unit.name,
      kind: unit.kind,
      commune: unit.commune,
      label: unit.label,
      runnable: [...unit.runnable].sort((a, b) => a - b),
    },
    geometry: unit.geometry,
  }))

  const file: ExploreAreaFile = {
    type: 'FeatureCollection',
    runomics: {
      schema: EXPLORE_SCHEMA,
      id: input.id,
      name: input.name,
      version: '',
      generatedAt: input.generatedAt,
      grid: { origin: [round6(input.grid.origin[0]), round6(input.grid.origin[1])], cellM: input.grid.cellM },
      bbox: areaBBox(input.units),
      sources: input.sources,
    },
    features,
  }
  file.runomics.version = areaVersion(file)
  return file
}

/** One line: area files are read by machines and diffed by nobody. */
export function serializeArea(file: ExploreAreaFile): string {
  return `${JSON.stringify(file)}\n`
}

export function areaRef(file: ExploreAreaFile): ExploreAreaRef & { file: string } {
  const { id, name, version, bbox } = file.runomics
  return { id, name, version, bbox, file: `${id}.geojson` }
}

/** Replaces the area's row, keeps every other area, and sorts by id. */
export function upsertIndex(index: ExploreIndexFile | null, row: ExploreAreaRef & { file: string }): ExploreIndexFile {
  const others = (index?.areas ?? []).filter((area) => area.id !== row.id)
  return { schema: EXPLORE_SCHEMA, areas: [...others, row].sort((a, b) => a.id.localeCompare(b.id)) }
}
