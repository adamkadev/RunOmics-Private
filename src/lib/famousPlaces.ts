import type { Map as MapLibreMap } from 'maplibre-gl'
import { cathedralsIn, type GeoBox } from '@/lib/reverseGeocode'
import { featureName, sourceOf } from '@/lib/runMapNames'

type LngLat = [number, number]

export type FamousKind = 'cathedral' | 'station' | 'stadium'

export interface FamousPlace {
  name: string
  kind: FamousKind
  at: LngLat
}

export const FAMOUS_WITHIN_M = 300
/** Past this across, a route has room for a third famous place on the card. */
const LARGE_ROUTE_M = 8000
const KIND_RANK: Record<FamousKind, number> = { cathedral: 0, station: 1, stadium: 2 }
/** The tiles file a stadium under its sport, with every pitch and gym: only its name says it is one. "City-stade" is a court. */
const STADIUM_NAME = /^(stade|stadium|stadion|estadio|estádio|stadio)\s|\s(stadium|stadion|arena)$/i
/** Every village has one: a town's own pitch is no place a friend would picture. */
const LOCAL_GROUND = /\b(municipal|municipale|communal|communale|annexe|terrain|entraînement|synthétique|city|sportplatz|recreation)\b/i

const M_PER_DEG = 111_320

export function isStadiumName(name: string): boolean {
  return STADIUM_NAME.test(name.trim()) && !LOCAL_GROUND.test(name)
}

/** Stations and stadiums from the tiles, which carry both at a run's zoom. */
export function tileFamousPlaces(map: MapLibreMap): FamousPlace[] {
  const out: FamousPlace[] = []
  const read = (sourceLayer: string, kindOf: (props: Record<string, unknown>, name: string) => FamousKind | null) => {
    const source = sourceOf(map, sourceLayer)
    for (const f of source ? map.querySourceFeatures(source, { sourceLayer }) : []) {
      const name = featureName(f.properties)
      if (!name || f.geometry.type !== 'Point') continue
      const kind = kindOf(f.properties ?? {}, name)
      if (kind) out.push({ name, kind, at: f.geometry.coordinates as LngLat })
    }
  }
  read('poi_station', (p) => (p.class === 'railway' && p.subclass === 'station' ? 'station' : null))
  read('poi_sport', (_, name) => (isStadiumName(name) ? 'stadium' : null))
  return out
}

function metresBetween(a: LngLat, b: LngLat): number {
  const k = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
  return Math.hypot((b[0] - a[0]) * k, b[1] - a[1]) * M_PER_DEG
}

export function metresFromRoute(at: LngLat, route: readonly LngLat[]): number {
  const k = Math.cos((at[1] * Math.PI) / 180)
  const toM = ([lng, lat]: LngLat): [number, number] => [(lng - at[0]) * k * M_PER_DEG, (lat - at[1]) * M_PER_DEG]
  let best = Infinity
  for (let i = 0; i < route.length; i++) {
    const [x2, y2] = toM(route[i]!)
    if (i === 0) {
      best = Math.hypot(x2, y2)
      continue
    }
    const [x1, y1] = toM(route[i - 1]!)
    const dx = x2 - x1
    const dy = y2 - y1
    const length2 = dx * dx + dy * dy
    const s = length2 === 0 ? 0 : Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / length2))
    best = Math.min(best, Math.hypot(x1 + s * dx, y1 + s * dy))
  }
  return best
}

/** Within 300 m of the route, a cathedral before a station before a stadium, the nearer first, each name once at its nearest. */
export function pickFamousPlaces(places: readonly FamousPlace[], route: readonly LngLat[], limit: number): FamousPlace[] {
  const seen = new Set<string>()
  return places
    .map((place) => ({ place, metres: metresFromRoute(place.at, route) }))
    .filter(({ metres }) => metres <= FAMOUS_WITHIN_M)
    .sort((a, b) => KIND_RANK[a.place.kind] - KIND_RANK[b.place.kind] || a.metres - b.metres)
    .filter(({ place }) => !seen.has(place.name) && seen.add(place.name))
    .slice(0, limit)
    .map(({ place }) => place)
}

export function routeBox(route: readonly LngLat[], marginM: number): GeoBox {
  const lngs = route.map((c) => c[0])
  const lats = route.map((c) => c[1])
  const dLat = marginM / M_PER_DEG
  const dLng = dLat / Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180)
  return [Math.min(...lngs) - dLng, Math.min(...lats) - dLat, Math.max(...lngs) + dLng, Math.max(...lats) + dLat]
}

/** Two famous places, three on a route over 8 km across, as the card counts its areas. */
export function famousLimit(route: readonly LngLat[]): number {
  const [w, s, e, n] = routeBox(route, 0)
  return Math.max(metresBetween([w, s], [e, s]), metresBetween([w, s], [w, n])) > LARGE_ROUTE_M ? 3 : 2
}

export async function findFamousPlaces(map: MapLibreMap, route: readonly LngLat[], token: string, limit: number): Promise<FamousPlace[]> {
  if (route.length === 0) return []
  const cathedrals = await cathedralsIn(routeBox(route, FAMOUS_WITHIN_M), token).catch(() => [])
  return pickFamousPlaces([...cathedrals.map((c) => ({ ...c, kind: 'cathedral' as const })), ...tileFamousPlaces(map)], route, limit)
}
