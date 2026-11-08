import type { Map as MapLibreMap } from 'maplibre-gl'
import { clipRing, groupRings, pickLandmark, pointInRing, ringsCentroid, type LngLat } from '@/lib/shareCardMap'
import {
  EVIDENT_M, evidentArea, firstName, geocodeLevel, pointsInside, shortGreenName, tilePlaceLevel,
  type EvidentArea, type GeocodedArea, type TilePlace,
} from '@/lib/shareCardPlaces'
import { geocodeAreas, GREEN_CATEGORIES, nearbyPark, START_DECIMALS } from '@/lib/reverseGeocode'
import { distanceKm } from '@/lib/math'
import { t } from '@/i18n'

export type Px = [number, number]

export const MAP_LANG = t.locale.split('-')[0] ?? 'en'

export function featureName(props: Record<string, unknown> | null | undefined): string {
  return String(props?.[`name:${MAP_LANG}`] ?? props?.name ?? '').trim()
}

/** The style's green fills: their polygons carry no name, a park's name is a POI point inside one. */
const GREEN_FILL_LAYERS = ['Wood', 'Forest', 'Grass', 'Cemetery']
const PARK_POI = { sourceLayer: 'poi_public', subclass: 'park' } as const

/** The tiles hold every source layer, styled or not: the vector source behind any styled one reads them all. */
export function sourceOf(map: MapLibreMap, sourceLayer: string): string | null {
  const layers = map.getStyle().layers as { 'source-layer'?: string; source?: string }[]
  const own = layers.find((l) => l['source-layer'] === sourceLayer) ?? layers.find((l) => l['source-layer'] && l.source)
  return own?.source ?? null
}

function outerRings(geometry: GeoJSON.Geometry): LngLat[][] {
  if (geometry.type === 'Polygon') return [geometry.coordinates[0] as LngLat[]]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((polygon) => polygon[0] as LngLat[])
  return []
}

const PLACE_SOURCE_LAYERS = ['place_label', 'town_label', 'city_label'] as const

/** Every named place in the tiles, styled or not, so a map can choose: MapLibre's own placement fenced them off the route. */
export function tilePlaces(map: MapLibreMap, project: (c: LngLat) => Px): TilePlace[] {
  const source = sourceOf(map, 'place_label')
  if (!source) return []
  const seen = new Set<string>()
  const out: TilePlace[] = []
  for (const sourceLayer of PLACE_SOURCE_LAYERS) {
    for (const f of map.querySourceFeatures(source, { sourceLayer })) {
      const name = featureName(f.properties)
      const level = tilePlaceLevel(sourceLayer, f.properties?.class)
      if (!name || !level || f.geometry.type !== 'Point' || seen.has(`${level}:${name}`)) continue
      seen.add(`${level}:${name}`)
      out.push({ name, level, at: project(f.geometry.coordinates as LngLat) })
    }
  }
  return out
}

export function metresPerPx(map: MapLibreMap, at: Px): number {
  const a = map.unproject(at)
  const b = map.unproject([at[0] + 100, at[1]])
  return (distanceKm(a.lng, a.lat, b.lng, b.lat) * 1000) / 100 || 1
}

export async function geocodedAt(map: MapLibreMap, at: Px, token: string, project: (c: LngLat) => Px): Promise<GeocodedArea[]> {
  const { lng, lat } = map.unproject(at)
  const out: GeocodedArea[] = []
  for (const f of await geocodeAreas(lng, lat, token, START_DECIMALS)) {
    const level = geocodeLevel(f.placeType)
    if (level) out.push({ name: f.text, ...level, at: f.center ? project(f.center) : undefined })
  }
  return out
}

export interface RouteNamesContext {
  map: MapLibreMap
  /** The route in the map's px. */
  route: Px[]
  token: string
  project: (c: LngLat) => Px
  /** Where a name may sit, [left, top, right, bottom] in the map's px. */
  room: readonly [number, number, number, number]
}

/** The smallest area a point is evidently in: a quarter from the tiles, else what the geocoder says holds it. */
export async function areaAt({ map, token, project }: RouteNamesContext, places: readonly TilePlace[], mPerPx: number, at: Px): Promise<EvidentArea | null> {
  const fromTiles = evidentArea(at, places, [], mPerPx)
  return fromTiles?.level === 'fine' ? fromTiles : evidentArea(at, places, await geocodedAt(map, at, token, project), mPerPx)
}

export type GreenName =
  | { found: true; name: string; at: Px }
  | { found: false; reason: 'no green' | 'no name' }

/** The green holding most of the route, named at its centre, then inside it, then from the tiles; placed on its part inside the room. */
export async function routeGreenName({ map, route, token, project, room }: RouteNamesContext, mPerPx: number, joined: boolean): Promise<GreenName> {
  const style = new Set(map.getStyle().layers.map((l) => l.id))
  const greenLayers = GREEN_FILL_LAYERS.filter((id) => style.has(id))
  const greens = greenLayers.length > 0 ? map.queryRenderedFeatures({ layers: greenLayers }) : []
  const rings = greens.flatMap((f) => outerRings(f.geometry)).map((ring) => ring.map(project)).filter((ring) => ring.length > 2)
  const groups = groupRings(rings)
  const green = pickLandmark(route, groups.map((group) => ({ name: '', at: ringsCentroid(group), rings: group })), joined)
  if (!green) return { found: false, reason: 'no green' }
  const shown = green.rings.map((ring) => clipRing(ring, room)).filter((ring) => ring.length > 2)
  const anchor = shown.length > 0 ? ringsCentroid(shown) : green.at
  const inGreen = (at: Px) => green.rings.some((ring) => pointInRing(at, ring))
  const parkAt = (at: Px, near: number) => async () => {
    const { lng, lat } = map.unproject(at)
    const park = await nearbyPark(lng, lat, token)
    if (!park) return null
    const p = project(park.at)
    return inGreen(p) || Math.hypot(p[0] - at[0], p[1] - at[1]) <= near ? { name: park.name, at: inGreen(p) ? p : anchor } : null
  }
  const landformAt = (at: Px) => async () => {
    const { lng, lat } = map.unproject(at)
    const found = (await geocodeAreas(lng, lat, token)).find((f) => f.categories.some((c) => GREEN_CATEGORIES.has(c)))
    return found ? { name: found.text, at: anchor } : null
  }
  const tileName = async () => {
    const source = sourceOf(map, PARK_POI.sourceLayer)
    for (const poi of source ? map.querySourceFeatures(source, { sourceLayer: PARK_POI.sourceLayer }) : []) {
      const name = featureName(poi.properties)
      if (!name || poi.geometry.type !== 'Point') continue
      const at = project(poi.geometry.coordinates as LngLat)
      if (inGreen(at)) return { name, at }
    }
    return null
  }
  const inside = pointsInside(green, route)
  const reach = EVIDENT_M / mPerPx
  const found = await firstName([
    parkAt(green.at, 0),
    ...inside.flatMap((p) => [parkAt(p, reach), landformAt(p)]),
    tileName,
  ])
  if (!found) return { found: false, reason: 'no name' }
  const inRoom = found.at[0] >= room[0] && found.at[0] <= room[2] && found.at[1] >= room[1] && found.at[1] <= room[3]
  return { found: true, name: shortGreenName(found.name), at: inRoom ? found.at : anchor }
}

export interface FoundRouteName {
  name: string
  at: LngLat
  kind: 'start' | 'green'
}

/** The start's quarter and the green the run spent the most distance in, at the map's current camera. */
export async function findRouteNames(
  map: MapLibreMap, route: readonly LngLat[], token: string, room: readonly [number, number, number, number], joined: boolean,
): Promise<FoundRouteName[]> {
  const project = (c: LngLat): Px => { const p = map.project(c); return [p.x, p.y] }
  const context: RouteNamesContext = { map, route: route.map(project), token, project, room }
  const start = context.route[0]
  if (!start) return []
  const places = tilePlaces(map, project)
  const mPerPx = metresPerPx(map, start)
  const [area, green] = await Promise.all([areaAt(context, places, mPerPx, start), routeGreenName(context, mPerPx, joined)])
  const lngLat = (at: Px): LngLat => { const { lng, lat } = map.unproject(at); return [lng, lat] }
  const out: FoundRouteName[] = []
  if (area) out.push({ name: area.name, at: route[0]!, kind: 'start' })
  if (green.found && green.name !== area?.name) out.push({ name: green.name, at: lngLat(green.at), kind: 'green' })
  return out
}
