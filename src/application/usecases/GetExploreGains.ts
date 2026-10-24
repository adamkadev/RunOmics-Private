import { activityCells, aggregateCoverage, buildAreaIndex } from '@/domain/explore/coverage'
import { parseAreaFile } from '@/domain/explore/areaFile'
import { exploreGains, type CompleteUnit, type ExploreGains, type RunExploreGain } from '@/domain/explore/gains'
import { medianStart } from '@/domain/explore/home'
import { exploredSummary, type ExploredSummary } from '@/domain/explore/summary'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { decodePolyline, encodePolyline } from '@/lib/polyline'
import {
  getLastExploreMilestoneState,
  saveLastExploreMilestoneState,
  type ExploreMilestoneState,
} from '@/infrastructure/repositories/FirestoreConfigRepository'
import { getAllRoutes } from './GetAllRoutes'
import { getExploreAreaFile, getExploreHome } from './GetExploreAreas'

interface HomeArea {
  gains: ExploreGains
  summary: ExploredSummary
}

let cache: { source: unknown; areaVersion: string; area: HomeArea } | null = null

/** The home area's runs, replayed once per data version; home is worked out here and never leaves the server. */
function homeArea(): HomeArea | null {
  const home = getExploreHome()
  if (!home) return null
  const source = getAllActivities()
  if (cache?.source === source && cache.areaVersion === home.area.version) return cache.area

  const read = getExploreAreaFile(home.area.id)
  const file = read ? parseAreaFile(JSON.parse(read.body)) : null
  if (!file) return null
  const index = buildAreaIndex(file)
  const { routes } = getAllRoutes()
  // Activities carry a date only; Garmin ids grow with time, so they order a day's runs.
  // Rounded through the polyline the map's worker decodes, or a cell on a boundary can count on one side only.
  const tracks = [...home.runs]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map((run) => ({ id: run.id, date: run.date, points: decodePolyline(encodePolyline(routes[run.routeIdx] ?? [])) }))
  const inputs = tracks.map(({ id, date, points }) => ({ id, date, ...activityCells(index, points.flat()) }))
  const start = medianStart(tracks.flatMap(({ points }) => (points[0] ? [points[0]] : [])))
  const area = { gains: exploreGains(index, inputs), summary: exploredSummary(aggregateCoverage(index, inputs, start)) }
  cache = { source, areaVersion: home.area.version, area }
  return area
}

export function getExploreGains(): ExploreGains | null {
  return homeArea()?.gains ?? null
}

export function getExploredSummary(): ExploredSummary | null {
  return homeArea()?.summary ?? null
}

/** Unit id → the day it passed 90 %, for the quartier sheet. */
export function getCompletedSince(): Record<string, string> {
  return Object.fromEntries((getExploreGains()?.complete ?? []).map((unit) => [unit.id, unit.since]))
}

export function getRunExploreGain(activityId: string): RunExploreGain | null {
  return getExploreGains()?.byRun.get(activityId) ?? null
}

/** With nothing stored for this area yet, a quartier already complete is old news: the first check only takes note. */
export function newlyComplete(complete: readonly CompleteUnit[], last: ExploreMilestoneState | null, areaId: string): CompleteUnit[] {
  if (!last || last.areaId !== areaId) return []
  const announced = new Set(last.announced)
  return complete.filter((unit) => !announced.has(unit.id))
}

/** Nothing is stored until `commit()`, so a failed push is offered again next run. */
export async function getExploreMilestones(): Promise<{
  newlyComplete: CompleteUnit[]
  completeCount: number
  unitCount: number
  commit: () => Promise<void>
}> {
  const gains = getExploreGains()
  const areaId = getExploreHome()?.area.id
  if (!gains || !areaId) return { newlyComplete: [], completeCount: 0, unitCount: 0, commit: async () => {} }
  const last = await getLastExploreMilestoneState()
  const kept = last?.areaId === areaId ? last.announced : []
  const announced = [...new Set([...kept, ...gains.complete.map((unit) => unit.id)])]
  return {
    newlyComplete: newlyComplete(gains.complete, last, areaId),
    completeCount: gains.complete.length,
    unitCount: gains.unitCount,
    commit: () => saveLastExploreMilestoneState({ areaId, announced }),
  }
}
