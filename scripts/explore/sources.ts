import type { MultiPolygon, Polygon } from 'geojson'
import type { BBox } from '@/domain/explore/geometry'
import { cachedFetch, HttpError, seconds, type FetchOptions, type FetchRequest } from './http'
import type { CityWfsSource } from './cities'
import type { Commune } from './communes'
import { assembleMultipolygon, type OsmMember } from './rings'
import { overpassProblem, runnableWaysQuery, tileBBox, wayCoords, type OverpassResponse } from './runnable'

// Only public things are sent: INSEE codes, the bbox of whole communes, and the cluster's frame rounded out. Never home.

export const GEOPF_WFS = 'https://data.geopf.fr/wfs/ows'
export const GEO_API = 'https://geo.api.gouv.fr'
export const DEFAULT_OVERPASS = 'https://overpass-api.de/api/interpreter'

export interface FetchRecord {
  label: string
  ms: number
  attempts: number
  cached: boolean
  bytes: number
}

export class Sources {
  readonly records: FetchRecord[] = []

  constructor(
    private readonly options: FetchOptions,
    readonly overpassUrl = DEFAULT_OVERPASS,
  ) {}

  async text(request: FetchRequest): Promise<string> {
    const result = await cachedFetch(request, this.options)
    const bytes = Buffer.byteLength(result.text)
    this.records.push({ label: request.label, ms: result.ms, attempts: result.attempts, cached: result.cached, bytes })
    const how = result.cached ? 'cached' : `${seconds(result.ms)}${result.attempts > 1 ? `, ${result.attempts} attempts` : ''}`
    console.log(`[explore] ${request.label}: ${how}, ${(bytes / 1e6).toFixed(2)} MB`)
    return result.text
  }

  async json<T>(request: FetchRequest): Promise<T> {
    return JSON.parse(await this.text(request)) as T
  }

  overpass(label: string, query: string): Promise<OverpassResponse> {
    return this.json<OverpassResponse>({
      label,
      url: this.overpassUrl,
      form: { data: query },
      // The query's own [timeout:180], plus the queue.
      timeoutMs: 240_000,
      validate: overpassProblem,
    })
  }
}

interface WfsFeature<P> {
  id?: string
  properties: P
  geometry: Polygon | MultiPolygon | null
}

interface WfsCollection<P> {
  features?: WfsFeature<P>[]
}

const wfsProblem = (text: string): string | null => {
  try {
    return Array.isArray((JSON.parse(text) as WfsCollection<unknown>).features) ? null : 'no features in the response'
  } catch {
    return 'the response is not JSON'
  }
}

function wfsUrl(base: string, typeName: string, filter: string): string {
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '2.0.0',
    REQUEST: 'GetFeature',
    TYPENAMES: typeName,
    OUTPUTFORMAT: 'application/json',
    SRSNAME: 'EPSG:4326',
    COUNT: '1000',
    CQL_FILTER: filter,
  })
  return `${base}?${params}`
}

function polygonal<P>(feature: WfsFeature<P>): feature is WfsFeature<P> & { geometry: Polygon | MultiPolygon } {
  return feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon'
}

interface AdminExpressCommune {
  code_insee: string
  nom_officiel: string
  population: number | null
}

export interface CommuneSet {
  communes: Commune[]
  /** ExploreSource.version, e.g. 'COG 2026'. */
  edition: string
}

/** The COG is published each spring; asking for the year rather than the LATEST alias names the edition in the sources. */
async function adminExpress(sources: Sources, label: string, filter: string, year: number): Promise<CommuneSet> {
  for (const edition of [year, year - 1]) {
    try {
      const collection = await sources.json<WfsCollection<AdminExpressCommune>>({
        label: `${label} (ADMIN EXPRESS COG ${edition})`,
        url: wfsUrl(GEOPF_WFS, `ADMINEXPRESS-COG.${edition}:commune`, filter),
        validate: wfsProblem,
      })
      const communes = (collection.features ?? []).filter(polygonal).map((feature) => ({
        code: feature.properties.code_insee,
        name: feature.properties.nom_officiel,
        population: Number(feature.properties.population ?? 0),
        geometry: feature.geometry,
      }))
      return { communes, edition: `COG ${edition}` }
    } catch (error) {
      // An edition the Géoplateforme does not have yet is a 400.
      if (!(error instanceof HttpError && error.status === 400)) throw error
    }
  }
  throw new Error(`${label}: no ADMIN EXPRESS COG edition for ${year} or ${year - 1}`)
}

/** The WFS tests envelopes; communes.ts tests the shapes. */
export function communesInBBox(sources: Sources, [minLon, minLat, maxLon, maxLat]: BBox, year: number): Promise<CommuneSet> {
  return adminExpress(sources, 'IGN communes around the cluster', `BBOX(geometrie,${minLon},${minLat},${maxLon},${maxLat},'EPSG:4326')`, year)
}

export async function communeByCode(sources: Sources, insee: string, year: number): Promise<Commune | undefined> {
  if (!/^\d[\dAB]\d{3}$/.test(insee)) throw new Error(`Not an INSEE code: ${insee}`)
  const { communes } = await adminExpress(sources, `IGN commune ${insee}`, `code_insee='${insee}'`, year)
  return communes[0]
}

interface GeoApiCommune {
  nom: string
  code: string
  centre?: { type: 'Point'; coordinates: [number, number] }
  population?: number
}

/** Asked by INSEE code, so nothing about the runs is sent. */
export async function communeCentre(sources: Sources, insee: string): Promise<[number, number]> {
  const commune = await sources.json<GeoApiCommune>({
    label: `geo.api.gouv.fr centre of ${insee}`,
    url: `${GEO_API}/communes/${insee}?fields=nom,code,centre,population`,
  })
  const centre = commune.centre?.coordinates
  if (!centre) throw new Error(`geo.api.gouv.fr has no centre for ${insee}`)
  return centre
}

export interface SourcedShape {
  /** The source's own id: an OSM relation id, a city feature id, an IRIS code. */
  sourceId: string
  name: string
  geometry: Polygon | MultiPolygon
}

/** A neighbour's quartier sharing a border way comes back too: the caller keeps those whose label point is inside. */
export async function osmAdmin10(sources: Sources, insee: string): Promise<{ shapes: SourcedShape[]; base: string | undefined; open: number }> {
  const query = [
    '[out:json][timeout:180];',
    `area["boundary"="administrative"]["admin_level"="8"]["ref:INSEE"="${insee}"]->.commune;`,
    'rel(area.commune)["boundary"="administrative"]["admin_level"="10"];',
    'out geom qt;',
  ].join('\n')
  const response = await sources.overpass(`Overpass admin_level=10 in ${insee}`, query)
  const shapes: SourcedShape[] = []
  let open = 0
  for (const element of (response.elements ?? []) as unknown as { type: string; id: number; tags?: Record<string, string>; members?: OsmMember[] }[]) {
    if (element.type !== 'relation') continue
    const assembled = assembleMultipolygon(element.members ?? [])
    open += assembled.open
    if (!assembled.geometry) continue
    shapes.push({ sourceId: String(element.id), name: element.tags?.name ?? `Quartier ${element.id}`, geometry: assembled.geometry })
  }
  return { shapes, base: response.osm3s?.timestamp_osm_base, open }
}

interface CityFeatureProperties {
  [field: string]: unknown
}

export async function cityQuartiers(sources: Sources, city: CityWfsSource): Promise<SourcedShape[]> {
  const collection = await sources.json<WfsCollection<CityFeatureProperties>>({
    label: `${city.sourceId} quartiers`,
    url: wfsUrl(city.wfs.url, city.wfs.typeName, city.wfs.cqlFilter),
    validate: wfsProblem,
  })
  return (collection.features ?? []).filter(polygonal).map((feature) => ({
    sourceId: String(feature.properties[city.wfs.idField]),
    name: String(feature.properties[city.wfs.nameField] ?? ''),
    geometry: feature.geometry,
  }))
}

export async function dataGouvDate(sources: Sources, city: CityWfsSource): Promise<string> {
  if (!city.dataGouvId) return city.fallbackVersion
  try {
    const dataset = await sources.json<{ last_modified?: string }>({
      label: `data.gouv.fr date of ${city.sourceId}`,
      url: `https://www.data.gouv.fr/api/1/datasets/${city.dataGouvId}/`,
    })
    return /^\d{4}-\d{2}-\d{2}/.test(dataset.last_modified ?? '') ? dataset.last_modified!.slice(0, 10) : city.fallbackVersion
  } catch (error) {
    console.warn(`[explore] data.gouv.fr unreachable (${error instanceof Error ? error.message : error}); dating ${city.sourceId} ${city.fallbackVersion}`)
    return city.fallbackVersion
  }
}

interface IrisProperties {
  code_iris: string
  nom_iris: string
  type_iris: string
}

export async function irisQuartiers(sources: Sources, insee: string): Promise<SourcedShape[]> {
  const collection = await sources.json<WfsCollection<IrisProperties>>({
    label: `IGN IRIS of ${insee}`,
    url: wfsUrl(GEOPF_WFS, 'STATISTICALUNITS.IRISGE:iris_ge', `code_insee='${insee}'`),
    validate: wfsProblem,
  })
  return (collection.features ?? []).filter(polygonal).map((feature) => ({
    sourceId: feature.properties.code_iris,
    name: feature.properties.nom_iris,
    geometry: feature.geometry,
  }))
}

/** Tiles of about 6.7 km a side at 49°N. */
const TILE_LON = 0.09
const TILE_LAT = 0.06

/** A way crossing a tile edge comes back from both tiles and is kept once. */
export async function runnableWays(sources: Sources, bbox: BBox): Promise<{ ways: number[][]; base: string | undefined }> {
  const tiles = tileBBox(bbox, TILE_LON, TILE_LAT)
  const seen = new Set<number>()
  const ways: number[][] = []
  let base: string | undefined
  for (const [i, tile] of tiles.entries()) {
    const response = await sources.overpass(`Overpass runnable ways, tile ${i + 1}/${tiles.length}`, runnableWaysQuery(tile))
    base ??= response.osm3s?.timestamp_osm_base
    for (const way of response.elements ?? []) {
      if (way.type !== 'way' || seen.has(way.id)) continue
      seen.add(way.id)
      ways.push(wayCoords(way))
    }
  }
  return { ways, base }
}
