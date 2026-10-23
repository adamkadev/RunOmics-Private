#!/usr/bin/env node
/**
 * Run by hand, then commit the two files it writes in the data repo; the app only ever reads them.
 *
 * The cluster's median start never leaves memory: its commune is found locally, and the grid's origin is the
 * city's public centre, never home. The city is the frame's most populous commune, as runs that start in a
 * small commune next to a city still belong to the city.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import type { MultiPolygon, Polygon } from 'geojson'
import { parseAreaFile, parseIndexFile } from '@/domain/explore/areaFile'
import { geometryBBox, inBBox, pointInGeometry, type BBox } from '@/domain/explore/geometry'
import { CELL_M, projection, type GridSpec, type Projection } from '@/domain/explore/grid'
import { medianStart } from '@/domain/explore/home'
import type { ExploreIndexFile, ExploreSource, UnitKind } from '@/domain/explore/types'
import { interopImport } from './interopImport'
import { areaRef, buildAreaFile, cityUnitId, communeUnitId, irisUnitId, osmUnitId, serializeArea, slugify, upsertIndex, type UnitInput } from './explore/area'
import { citySource, displayName } from './explore/cities'
import { communeContaining, geometryIntersectsBBox, mostPopulous, roundOutward, unionBBox, type Commune } from './explore/communes'
import { seconds } from './explore/http'
import { labelPoint } from './explore/labelPoint'
import { assignCells, RUNNABLE_STEP_M, wayCells } from './explore/runnable'
import { geometryAreaM2, simplifyGeometry, SIMPLIFY_M, vertexCount } from './explore/simplify'
import {
  DEFAULT_OVERPASS,
  Sources,
  cityQuartiers,
  communeByCode,
  communeCentre,
  communesInBBox,
  dataGouvDate,
  irisQuartiers,
  osmAdmin10,
  runnableWays,
} from './explore/sources'

/** OSM quartiers are used only when they cover this much of the commune; a handful of mapped ones would leave holes. */
const OSM_MIN_COVERAGE = 0.8

const ODBL: Pick<ExploreSource, 'licence' | 'url'> = { licence: 'ODbL 1.0', url: 'https://www.openstreetmap.org/copyright' }
const LICENCE_OUVERTE = 'Licence Ouverte 2.0'

interface Options {
  dataDir?: string
  cluster?: number
  insee?: string
  refresh: boolean
  overpass: string
}

function usage(): string {
  return 'Usage: npm run explore:areas -- [--cluster <index>] [--insee <code>] [--data-dir <dir>] [--refresh] [--overpass <url>]'
}

function parseArgs(args: string[]): Options {
  const options: Options = { refresh: false, overpass: DEFAULT_OVERPASS }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    const value = () => {
      const next = args[++i]
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value\n${usage()}`)
      return next
    }
    if (arg === '--refresh') options.refresh = true
    else if (arg === '--data-dir') options.dataDir = value()
    else if (arg === '--insee') options.insee = value()
    else if (arg === '--overpass') options.overpass = value()
    else if (arg === '--cluster') {
      const index = Number(value())
      if (!Number.isInteger(index) || index < 0) throw new Error(`--cluster takes a cluster index (0 is the busiest)\n${usage()}`)
      options.cluster = index
    } else if (arg === '--help' || arg === '-h') {
      console.log(usage())
      process.exit(0)
    } else throw new Error(`Unknown option ${arg}\n${usage()}`)
  }
  return options
}

interface RawUnit {
  id: string
  name: string
  kind: UnitKind
  commune: string
  geometry: Polygon | MultiPolygon
}

interface Quartiers {
  units: RawUnit[]
  sources: ExploreSource[]
  /** How the city was split, for the log. */
  via: string
}

/** An unreachable source fails the build rather than falling through: a silent fallback would swap quartiers for IRIS with new ids. */
async function quartiersOf(sources: Sources, city: Commune, areaId: string, p: Projection, year: number): Promise<Quartiers> {
  const cityArea = geometryAreaM2(city.geometry, p)

  const osm = await osmAdmin10(sources, city.code)
  const inside = osm.shapes.filter((shape) => {
    try {
      const [lon, lat] = labelPoint(shape.geometry, p)
      return pointInGeometry(lon, lat, city.geometry)
    } catch {
      return false
    }
  })
  const covered = inside.reduce((sum, shape) => sum + geometryAreaM2(shape.geometry, p), 0) / cityArea
  if (inside.length >= 2 && covered >= OSM_MIN_COVERAGE) {
    return {
      units: inside.map((shape) => ({ id: osmUnitId(Number(shape.sourceId)), name: shape.name, kind: 'quartier', commune: city.name, geometry: shape.geometry })),
      sources: [{ id: 'osm-admin10', label: '© OpenStreetMap contributors – quartier boundaries', ...ODBL, version: (osm.base ?? '').slice(0, 10) }],
      via: `OSM admin_level=10 (${inside.length} boundaries, ${Math.round(covered * 100)}% of the commune)`,
    }
  }
  console.log(`[explore] OSM has ${inside.length} admin_level=10 boundar${inside.length === 1 ? 'y' : 'ies'} in ${city.name} (${Math.round(covered * 100)}% of it): not enough`)

  const registered = citySource(city.code)
  if (registered) {
    const shapes = await cityQuartiers(sources, registered)
    if (shapes.length >= 2) {
      const version = await dataGouvDate(sources, registered)
      return {
        units: shapes.map((shape) => ({
          id: cityUnitId(areaId, shape.sourceId),
          name: displayName(registered, shape.name),
          kind: 'quartier',
          commune: city.name,
          geometry: shape.geometry,
        })),
        sources: [{ id: registered.sourceId, label: registered.label, licence: registered.licence, url: registered.url, version }],
        via: `${registered.sourceId} (${shapes.length} quartiers)`,
      }
    }
    console.log(`[explore] ${registered.sourceId} returned ${shapes.length} quartier(s): not enough`)
  }

  const iris = await irisQuartiers(sources, city.code)
  if (iris.length >= 2) {
    return {
      units: iris.map((shape) => ({ id: irisUnitId(shape.sourceId), name: shape.name, kind: 'quartier', commune: city.name, geometry: shape.geometry })),
      sources: [{
        id: 'ign-iris',
        label: 'IGN – INSEE, Contours… IRIS®',
        licence: LICENCE_OUVERTE,
        url: 'https://geoservices.ign.fr/contoursiris',
        version: `IRIS-GE, ${year}`,
      }],
      via: `IGN IRIS (${iris.length})`,
    }
  }

  return { units: [{ id: communeUnitId(city.code), name: city.name, kind: 'commune', commune: city.name, geometry: city.geometry }], sources: [], via: 'the commune itself' }
}

/** One that is there but unreadable stops the build: rewriting it from scratch would drop the other areas it lists. */
function readIndex(indexPath: string): ExploreIndexFile | null {
  if (!fs.existsSync(indexPath)) return null
  const index = parseIndexFile(JSON.parse(fs.readFileSync(indexPath, 'utf8')))
  if (!index) throw new Error(`${indexPath} is not a valid Explore index; fix or remove it, then run again`)
  return index
}

/** Written aside and renamed, so the app never reads half a file. */
function writeAtomically(file: string, text: string): void {
  fs.writeFileSync(`${file}.part`, text)
  fs.renameSync(`${file}.part`, file)
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  // Set before anything reads the data: dataPath() and the activity cache take the directory from the environment.
  if (options.dataDir) process.env.RUNOMICS_DATA_DIR = path.resolve(options.dataDir)
  const { dataPath } = await interopImport(import('@/infrastructure/dataPath'))
  const dir = dataPath('explore')
  console.log(`[explore] data: ${dataPath()}`)

  const generatedAt = new Date().toISOString().slice(0, 10)
  const year = Number(generatedAt.slice(0, 4))
  const sources = new Sources({ refresh: options.refresh }, options.overpass)

  const { getAllRoutes } = await interopImport(import('@/application/usecases/GetAllRoutes'))
  const all = getAllRoutes()
  const clusterIdx = options.cluster ?? all.defaultClusterIdx
  const cluster = all.clusters[clusterIdx]
  if (!cluster) throw new Error(`No cluster ${clusterIdx}: there are ${all.clusters.length} (0 is the busiest)`)
  console.log(`[explore] cluster ${clusterIdx} of ${all.clusters.length}: ${cluster.routeCount} runs, ${cluster.totalKm} km`)

  // In memory only.
  const start = medianStart(cluster.routeIndices.flatMap((i) => (all.routes[i]?.[0] ? [all.routes[i]![0]!] : [])))
  if (!start) throw new Error(`Cluster ${clusterIdx} has no run with a start`)
  const { minLon, minLat, maxLon, maxLat } = cluster.frame
  const frame: BBox = [minLon, minLat, maxLon, maxLat]

  // The query box also covers the start, so a cluster whose start falls outside its own frame is still checked.
  const queryBox = roundOutward(inBBox(start[0], start[1], frame) ? frame : unionBBox([frame, [start[0], start[1], start[0], start[1]]]))
  const nearby = await communesInBBox(sources, queryBox, year)
  const home = communeContaining(start[0], start[1], nearby.communes)
  if (!home && !options.insee) {
    console.error(
      `[explore] Cluster ${clusterIdx}'s runs do not start in a French commune. Explore areas are built from French ` +
        'boundaries (IGN, INSEE) only, so this cluster gets no area and no file was written.',
    )
    process.exitCode = 1
    return
  }
  if (home) console.log(`[explore] the runs start in ${home.name} (${home.code})`)

  const inFrame = nearby.communes.filter((commune) => geometryIntersectsBBox(commune.geometry, frame))
  const city = options.insee
    ? inFrame.find((commune) => commune.code === options.insee) ?? (await communeByCode(sources, options.insee, year))
    : mostPopulous(inFrame)
  if (!city) throw new Error(options.insee ? `IGN has no commune ${options.insee}` : 'No commune meets the cluster frame')
  console.log(
    `[explore] city: ${city.name} (${city.code}, ${city.population} inhabitants)` +
      (options.insee ? ', from --insee' : `, the most populous of the ${inFrame.length} communes the frame meets`),
  )

  // The city's quartiers first: they win a cell over a neighbouring commune where the sources overlap.
  const origin = await communeCentre(sources, city.code)
  const grid: GridSpec = { origin, cellM: CELL_M }
  const p = projection(grid)
  const areaId = slugify(city.name)

  const quartiers = await quartiersOf(sources, city, areaId, p, year)
  console.log(`[explore] ${city.name} split by ${quartiers.via}`)
  const others: RawUnit[] = inFrame
    .filter((commune) => commune.code !== city.code)
    .map((commune) => ({ id: communeUnitId(commune.code), name: commune.name, kind: 'commune', commune: commune.name, geometry: commune.geometry }))
  const raw = [...quartiers.units, ...others]

  const union = unionBBox(raw.map((unit) => geometryBBox(unit.geometry)))
  const runnable = await runnableWays(sources, union)
  const cells = new Set<number>()
  for (const coords of runnable.ways) wayCells(coords, p, cells, RUNNABLE_STEP_M)
  const assigned = assignCells(cells, raw, p)
  console.log(`[explore] ${runnable.ways.length} runnable ways -> ${cells.size} cells in the box`)

  const units: UnitInput[] = raw.map((unit) => {
    const geometry = simplifyGeometry(unit.geometry, p, SIMPLIFY_M)
    return {
      id: unit.id,
      name: unit.name,
      kind: unit.kind,
      commune: unit.commune,
      label: labelPoint(geometry, p, [unit.geometry]),
      runnable: assigned.get(unit.id) ?? [],
      geometry,
    }
  })
  const rawVertices = raw.reduce((sum, unit) => sum + vertexCount(unit.geometry), 0)
  const keptVertices = units.reduce((sum, unit) => sum + vertexCount(unit.geometry), 0)
  console.log(`[explore] simplified at ${SIMPLIFY_M} m: ${rawVertices} -> ${keptVertices} vertices`)

  const fileSources: ExploreSource[] = [...quartiers.sources]
  if (raw.some((unit) => unit.kind === 'commune')) {
    fileSources.push({ id: 'ign-commune', label: 'IGN – ADMIN EXPRESS COG', licence: LICENCE_OUVERTE, url: 'https://geoservices.ign.fr/adminexpress', version: nearby.edition })
  }
  fileSources.push({ id: 'osm-runnable', label: '© OpenStreetMap contributors – runnable ways', ...ODBL, version: (runnable.base ?? generatedAt).slice(0, 10) })

  const area = buildAreaFile({ id: areaId, name: city.name, generatedAt, grid, sources: fileSources, units })
  const text = serializeArea(area)
  // The app reads the file through the same check: fail here, not on a phone.
  if (!parseAreaFile(JSON.parse(text))) throw new Error('The built area does not pass parseAreaFile; nothing was written')
  // The app matches a cluster to the area whose bbox holds its labelPoint.
  const [lon, lat] = cluster.labelPoint
  if (!inBBox(lon, lat, area.runomics.bbox)) {
    console.warn(`[explore] warning: the cluster's label point is outside this area's bbox, so the map will not pick it for cluster ${clusterIdx}`)
  }

  fs.mkdirSync(dir, { recursive: true })
  const indexPath = path.join(dir, 'index.json')
  const index = upsertIndex(readIndex(indexPath), areaRef(area))
  const file = path.join(dir, `${areaId}.geojson`)
  writeAtomically(file, text)
  writeAtomically(indexPath, `${JSON.stringify(index, null, 2)}\n`)

  // Summary: names and counts only.
  console.log(`\n${area.runomics.name} (${area.runomics.id}), version ${area.runomics.version}`)
  const width = Math.max(...area.features.map((feature) => feature.properties.name.length))
  for (const feature of area.features) {
    const { name, kind, runnable: keys } = feature.properties
    console.log(`  ${name.padEnd(width)}  ${kind.padEnd(8)}  ${String(keys.length).padStart(5)} cells`)
  }
  const total = area.features.reduce((sum, feature) => sum + feature.properties.runnable.length, 0)
  const counts = (kind: UnitKind) => area.features.filter((feature) => feature.properties.kind === kind).length
  console.log(`  ${counts('quartier')} quartiers + ${counts('commune')} communes, ${total} runnable cells`)
  const empty = area.features.filter((feature) => feature.properties.runnable.length === 0)
  if (empty.length) console.warn(`  no runnable cell (dropped by the app): ${empty.map((feature) => feature.properties.name).join(', ')}`)
  console.log(`  ${file}: ${kb(Buffer.byteLength(text))} raw, ${kb(zlib.gzipSync(text).length)} gzip`)
  console.log(`  ${indexPath}: ${index.areas.length} area(s)`)
  console.log('  Sources:')
  for (const source of area.runomics.sources) console.log(`    ${source.id}: ${source.label} (${source.licence}, ${source.version})`)
  console.log('  Fetches:')
  for (const record of sources.records) {
    console.log(`    ${record.label}: ${record.cached ? 'cached' : `${seconds(record.ms)}, ${record.attempts} attempt(s)`}, ${kb(record.bytes)}`)
  }
}

main().catch((error) => {
  console.error(`[explore] ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
