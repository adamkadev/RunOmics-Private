import { pointInRing, type GreenArea } from '@/lib/shareCardMap'

type Px = [number, number]

/** Smallest first: a quarter, then a district or village, then the town. */
export type PlaceLevel = 'fine' | 'mid' | 'city'
export const PLACE_LEVELS: readonly PlaceLevel[] = ['fine', 'mid', 'city']

/** A named place the tiles hold, in the card's px. */
export interface TilePlace {
  name: string
  level: PlaceLevel
  at: Px
}

/** An area the geocoder found at a point. `contains` is false for a nearby place it only points at. */
export interface GeocodedArea {
  name: string
  level: PlaceLevel
  contains: boolean
  at?: Px
}

/** A place is evident from a point within this distance of its name: nearer than a quarter's own size. */
export const EVIDENT_M = 300

/** A stretch of route belongs to the nearest name within this distance: the tiles hold no area outlines. */
const AREA_REACH_M = 1500
/** The share of the route an area must hold to count as passed when the route never nears its name. */
const AREA_MIN_SHARE = 0.1

/** Over this span, a run crosses enough places to name more of them. */
const LARGE_ROUTE_M = 8000

function bare(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/^quartier\s+(de la |de l'|du |des |de |d')?/, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

/** "Quartier du Gros-Caillou" from the geocoder and "Gros-Caillou" from the tiles are one place. */
export function sameArea(a: string, b: string): boolean {
  const [x, y] = [bare(a), bare(b)]
  return x === y || (x.length > 0 && y.length > 0 && (` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `)))
}

export function tilePlaceLevel(sourceLayer: string, placeClass: unknown): PlaceLevel | null {
  if (sourceLayer === 'town_label' || sourceLayer === 'city_label') return 'city'
  if (sourceLayer !== 'place_label') return null
  if (placeClass === 'neighbourhood' || placeClass === 'quarter' || placeClass === 'hamlet') return 'fine'
  if (placeClass === 'suburb' || placeClass === 'village') return 'mid'
  return null
}

/** MapTiler's place types; `place` is the nearest named place, not one the point is inside. */
export function geocodeLevel(placeType: string): { level: PlaceLevel; contains: boolean } | null {
  if (placeType === 'locality' || placeType === 'neighbourhood') return { level: 'fine', contains: true }
  if (placeType === 'place') return { level: 'fine', contains: false }
  if (placeType === 'municipal_district' || placeType === 'joint_submunicipality') return { level: 'mid', contains: true }
  if (placeType === 'municipality' || placeType === 'joint_municipality') return { level: 'city', contains: true }
  return null
}

function nearest(point: Px, places: readonly TilePlace[]): { place: TilePlace; px: number } | null {
  let best: { place: TilePlace; px: number } | null = null
  for (const place of places) {
    const px = Math.hypot(place.at[0] - point[0], place.at[1] - point[1])
    if (!best || px < best.px) best = { place, px }
  }
  return best
}

export interface EvidentArea {
  name: string
  level: PlaceLevel
  /** Where the tiles name it, when they do. */
  at: Px | null
}

/** The smallest area a point is evidently in, quarter up: a tile name within EVIDENT_M, else one the geocoder says holds it. */
export function evidentArea(point: Px, places: readonly TilePlace[], geocoded: readonly GeocodedArea[], mPerPx: number): EvidentArea | null {
  const reach = EVIDENT_M / mPerPx
  for (const level of PLACE_LEVELS) {
    const tile = nearest(point, places.filter((p) => p.level === level))
    if (tile && tile.px <= reach) return { name: tile.place.name, level, at: tile.place.at }
    const geo = geocoded.find((g) => g.level === level && (g.contains || (g.at && Math.hypot(g.at[0] - point[0], g.at[1] - point[1]) <= reach)))
    if (geo) return { name: geo.name, level, at: places.find((p) => p.name === geo.name)?.at ?? null }
  }
  return null
}

export interface PassedArea extends TilePlace {
  /** Route length, in px, nearer this place's name than any other's. */
  distance: number
}

/** The areas the route passes, longest stretch first; quarters and districts before towns, a town only when none is. */
export function passedAreas(
  route: readonly Px[], places: readonly TilePlace[], mPerPx: number,
  { exclude = [], limit, spacingPx = 0, levels = ['fine', 'mid'] }: { exclude?: readonly string[]; limit: number; spacingPx?: number; levels?: readonly PlaceLevel[] },
): PassedArea[] {
  const near = EVIDENT_M / mPerPx
  const far = AREA_REACH_M / mPerPx
  const pool = places.filter((p) => levels.includes(p.level))
  const share = new Map<TilePlace, number>()
  let total = 0
  for (let i = 1; i < route.length; i++) {
    const [x1, y1] = route[i - 1]!
    const [x2, y2] = route[i]!
    const length = Math.hypot(x2 - x1, y2 - y1)
    total += length
    const owner = nearest([(x1 + x2) / 2, (y1 + y2) / 2], pool)
    if (owner && owner.px <= far) share.set(owner.place, (share.get(owner.place) ?? 0) + length)
  }
  const passed = pool.filter((p) => !exclude.some((name) => sameArea(name, p.name))
    && ((share.get(p) ?? 0) >= AREA_MIN_SHARE * total || route.some((q) => Math.hypot(q[0] - p.at[0], q[1] - p.at[1]) <= near)))
  const ranked = passed.map((p) => ({ ...p, distance: share.get(p) ?? 0 })).sort((a, b) => b.distance - a.distance)
  const out: PassedArea[] = []
  for (const area of ranked) {
    if (out.length >= limit) break
    if (out.some((o) => Math.hypot(o.at[0] - area.at[0], o.at[1] - area.at[1]) < spacingPx)) continue
    out.push(area)
  }
  if (out.length === 0 && !levels.includes('city')) return passedAreas(route, places, mPerPx, { exclude, limit, spacingPx, levels: ['city'] })
  return out
}

/** Two other places on a run around a town, up to four on one that spans more than LARGE_ROUTE_M. */
export function areaLimit(route: readonly Px[], mPerPx: number): number {
  const xs = route.map((p) => p[0])
  const ys = route.map((p) => p[1])
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * mPerPx
  return span > LARGE_ROUTE_M ? 4 : 2
}

/** The route's point inside the area nearest its centre, then up to three more inside it, spread along the route. */
export function pointsInside(area: Pick<GreenArea, 'at' | 'rings'>, route: readonly Px[], extra = 3): Px[] {
  const inside = route.filter((p) => area.rings.some((ring) => pointInRing(p, ring)))
  if (inside.length === 0) return area.rings.some((ring) => pointInRing(area.at, ring)) ? [area.at] : []
  const first = inside.reduce((a, b) => (Math.hypot(b[0] - area.at[0], b[1] - area.at[1]) < Math.hypot(a[0] - area.at[0], a[1] - area.at[1]) ? b : a))
  const step = Math.max(1, Math.floor(inside.length / (extra + 1)))
  const spread = inside.filter((_, i) => i > 0 && i % step === 0 && inside[i] !== first).slice(0, extra)
  return [first, ...spread]
}

/** Each source in order until one names the landmark. */
export async function firstName<T>(sources: readonly (() => Promise<T | null>)[]): Promise<T | null> {
  for (const source of sources) {
    const found = await source().catch(() => null)
    if (found) return found
  }
  return null
}
