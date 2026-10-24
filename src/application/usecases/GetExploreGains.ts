import { buildAreaIndex } from '@/domain/explore/coverage'
import { parseAreaFile } from '@/domain/explore/areaFile'
import { exploreGains, type CompleteUnit, type ExploreGains, type RunExploreGain } from '@/domain/explore/gains'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { decodePolyline, encodePolyline } from '@/lib/polyline'
import {
  getLastExploreMilestoneState,
  saveLastExploreMilestoneState,
  type ExploreMilestoneState,
} from '@/infrastructure/repositories/FirestoreConfigRepository'
import { getAllRoutes } from './GetAllRoutes'
import { getExploreAreaFile, getExploreHome } from './GetExploreAreas'

let cache: { source: unknown; areaVersion: string; gains: ExploreGains } | null = null

export function getExploreGains(): ExploreGains | null {
  const home = getExploreHome()
  if (!home) return null
  const source = getAllActivities()
  if (cache?.source === source && cache.areaVersion === home.area.version) return cache.gains

  const read = getExploreAreaFile(home.area.id)
  const file = read ? parseAreaFile(JSON.parse(read.body)) : null
  if (!file) return null
  const { routes } = getAllRoutes()
  // Activities carry a date only; Garmin ids grow with time, so they order a day's runs.
  // Rounded through the polyline the Explored card's worker decodes, or a cell on a boundary can count on one side only.
  const runs = [...home.runs]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map((run) => ({ id: run.id, coords: decodePolyline(encodePolyline(routes[run.routeIdx] ?? [])).flat() }))
  const gains = exploreGains(buildAreaIndex(file), runs)
  cache = { source, areaVersion: home.area.version, gains }
  return gains
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
