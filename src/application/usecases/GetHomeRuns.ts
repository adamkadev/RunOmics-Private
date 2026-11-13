import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity } from '@/domain/activity/types'
import { homeSpots, pointSeconds, thinIndices } from '@/domain/activity/homeRuns'
import { parseAreaFile } from '@/domain/explore/areaFile'
import { inBBox, pointInGeometry } from '@/domain/explore/geometry'
import { encodeIntegers, encodePolyline } from '@/lib/polyline'
import { getExploreAreaFile, getExploreAreas } from './GetExploreAreas'

/** The original replay's radius: a start across the street still counts as home. */
export const START_RADIUS_M = 200
/** More than 20 runs from one start: fewer make a thin replay, and the hub row and the page stay away until then. */
const MIN_RUNS = 21
const MAX_SPOTS = 3
/** Enough for a curve at the replay's scale; ~200 runs stay a few hundred kB. */
const MAX_POINTS = 240
const PREVIEW_POINTS = 40

export interface HomeRun {
  id: string
  date: string
  durationSeconds: number
  distanceKm: number
  /** Encoded polyline at 1e-5°. */
  track: string
  /** Whole seconds into the run at each track point, as deltas in polyline characters. */
  times: string
}

export interface HomeRunSpot {
  runs: HomeRun[]
  firstDate: string
  lastDate: string
  totalKm: number
  /** The town the start sits in, or its district when another home shares the town; null outside every area. */
  place: string | null
}

export interface HomeRunsSummary {
  runCount: number
  firstDate: string
  lastDate: string
  /** An SVG path of the spot's runs in a 100 × 100 box. */
  preview: string
}

interface Built {
  spots: { activities: Activity[]; center: [number, number] }[]
}

let cache: { source: Activity[]; built: Built } | null = null

function build(): Built {
  const source = getAllActivities()
  if (cache?.source === source) return cache.built
  const runs = source.filter((a) => a.route && a.route.length > 1 && a.durationSeconds > 0)
  const spots = homeSpots(runs.map((a) => a.route![0]!), START_RADIUS_M, MIN_RUNS)
    .slice(0, MAX_SPOTS)
    .map((spot) => ({
      activities: spot.members.map((i) => runs[i]!).sort((a, b) => a.date.localeCompare(b.date)),
      center: spot.center,
    }))
  const built = { spots }
  cache = { source, built }
  return built
}

function deltas(values: readonly number[]): number[] {
  return values.map((v, i) => v - (i > 0 ? values[i - 1]! : 0))
}

function homeRun(a: Activity): HomeRun {
  const route = a.route!
  const seconds = pointSeconds(route, a.paceSamples, a.durationSeconds)
  const kept = thinIndices(route.length, MAX_POINTS)
  return {
    id: a.id,
    date: a.date,
    durationSeconds: a.durationSeconds,
    distanceKm: a.distanceKm,
    track: encodePolyline(kept.map((i) => route[i]!)),
    times: encodeIntegers(deltas(kept.map((i) => Math.round(seconds[i]!)))),
  }
}

function placeAt([lon, lat]: [number, number]): { commune: string; district: string } | null {
  for (const area of getExploreAreas()) {
    if (!inBBox(lon, lat, area.bbox)) continue
    const read = getExploreAreaFile(area.id)
    const file = read ? parseAreaFile(JSON.parse(read.body)) : null
    const unit = file?.features.find((feature) => pointInGeometry(lon, lat, feature.geometry))
    if (unit) return { commune: unit.properties.commune, district: unit.properties.name }
  }
  return null
}

export function getHomeRuns(): HomeRunSpot[] {
  const spots = build().spots
  const places = spots.map(({ center }) => placeAt(center))
  // The town tells the homes apart; two homes in the same town fall back to their districts.
  const shared = (commune: string) => places.filter((p) => p?.commune === commune).length > 1
  return spots.map(({ activities }, i) => {
    const place = places[i]
    return {
      runs: activities.map(homeRun),
      firstDate: activities[0]!.date,
      lastDate: activities[activities.length - 1]!.date,
      totalKm: Math.round(activities.reduce((sum, a) => sum + a.distanceKm, 0)),
      place: place ? (shared(place.commune) ? place.district : place.commune) : null,
    }
  })
}

function previewPath(activities: readonly Activity[]): string {
  const tracks = activities.map((a) => thinIndices(a.route!.length, PREVIEW_POINTS).map((i) => a.route![i]!))
  const all = tracks.flat()
  const kx = Math.cos((all[0]![1] * Math.PI) / 180)
  const xs = all.map(([lon]) => lon * kx)
  const ys = all.map(([, lat]) => -lat)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1
  const offX = (span - (Math.max(...xs) - minX)) / 2
  const offY = (span - (Math.max(...ys) - minY)) / 2
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString()
  return tracks
    .map((track) => track
      .map(([lon, lat], i) => `${i ? 'L' : 'M'}${fmt(((lon * kx - minX + offX) / span) * 100)} ${fmt(((-lat - minY + offY) / span) * 100)}`)
      .join(''))
    .join('')
}

/** The biggest spot only, for the Progress tile; null without one. */
export function getHomeRunsSummary(): HomeRunsSummary | null {
  const spot = build().spots[0]
  if (!spot) return null
  return { runCount: spot.activities.length, firstDate: spot.activities[0]!.date, lastDate: spot.activities.at(-1)!.date, preview: previewPath(spot.activities) }
}
