import { activityCells, aggregateCoverage, buildAreaIndex } from '@/domain/explore/coverage'
import { parseAreaFile } from '@/domain/explore/areaFile'
import { exploreGains, type CompleteUnit, type ExploreGains, type RunExploreGain } from '@/domain/explore/gains'
import type { ExploreAreaRef } from '@/domain/explore/types'
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
import { getExploreAreaFile, getExploreHomes, type ExploreHome } from './GetExploreAreas'

export interface ExploredArea {
  area: ExploreAreaRef
  /** 'YYYY-MM-DD' of the newest run there. */
  lastRunDate: string
  gains: ExploreGains
  summary: ExploredSummary
}

let cache: { source: unknown; versions: string; areas: ExploredArea[] } | null = null

/** One area's runs, replayed oldest first; its home is worked out here and never leaves the server. */
function replay(home: ExploreHome): ExploredArea | null {
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
  return {
    area: home.area,
    lastRunDate: tracks.at(-1)?.date ?? '',
    gains: exploreGains(index, inputs),
    summary: exploredSummary(aggregateCoverage(index, inputs, start)),
  }
}

/** Every area the runs fall in, busiest first, replayed once per data version. */
export function getExploredAreas(): ExploredArea[] {
  const homes = getExploreHomes()
  const source = getAllActivities()
  const versions = homes.map((home) => `${home.area.id}@${home.area.version}`).join(',')
  if (cache?.source === source && cache.versions === versions) return cache.areas
  const areas = homes.flatMap((home) => replay(home) ?? [])
  cache = { source, versions, areas }
  return areas
}

/** Unit id → the day it passed 90 %, for the quartier sheet; ids are unique across areas. */
export function getCompletedSince(): Record<string, string> {
  return Object.fromEntries(getExploredAreas().flatMap((explored) => explored.gains.complete.map((unit) => [unit.id, unit.since])))
}

export function getRunExploreGain(activityId: string): RunExploreGain | null {
  for (const explored of getExploredAreas()) {
    const gain = explored.gains.byRun.get(activityId)
    if (gain) return gain
  }
  return null
}

/** Read as one list per area; the single-area shape stored before is that area's list. */
export function announcedByArea(state: ExploreMilestoneState | null): Record<string, string[]> {
  if (!state) return {}
  if (state.areas) return state.areas
  return state.areaId && state.announced ? { [state.areaId]: state.announced } : {}
}

/** With nothing stored for an area yet, a quartier already complete there is old news: the first check only takes note. */
export function newlyComplete(complete: readonly CompleteUnit[], announced: readonly string[] | undefined): CompleteUnit[] {
  if (!announced) return []
  const known = new Set(announced)
  return complete.filter((unit) => !known.has(unit.id))
}

export interface ExploreMilestone {
  unit: CompleteUnit
  completeCount: number
  unitCount: number
}

/** Nothing is stored until `commit()`, so a failed push is offered again next run. */
export async function getExploreMilestones(): Promise<{ milestones: ExploreMilestone[]; commit: () => Promise<void> }> {
  const areas = getExploredAreas()
  if (areas.length === 0) return { milestones: [], commit: async () => {} }
  const stored = announcedByArea(await getLastExploreMilestoneState())
  const next: Record<string, string[]> = { ...stored }
  const milestones = areas.flatMap(({ area, gains }) => {
    next[area.id] = [...new Set([...(stored[area.id] ?? []), ...gains.complete.map((unit) => unit.id)])]
    return newlyComplete(gains.complete, stored[area.id]).map((unit) => ({ unit, completeCount: gains.complete.length, unitCount: gains.unitCount }))
  })
  return { milestones, commit: () => saveLastExploreMilestoneState({ areas: next }) }
}
