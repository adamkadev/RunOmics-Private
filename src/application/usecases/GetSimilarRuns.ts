import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity } from '@/domain/activity/types'
import {
  buildRouteCellSet,
  isSimilarDistance,
  routeSimilarity,
  SIMILAR_ROUTE_MIN_SIMILARITY,
  type RouteCellSet,
} from '@/lib/routeMatch'

export interface SimilarRun {
  id: string
  date: string
  durationSeconds: number
  distanceKm: number
  paceSecPerKm: number
  rank: number
  isCurrent: boolean
}

export interface SimilarRunsData {
  runs: SimilarRun[]
  count: number
  currentRank: number
  bestPaceSecPerKm: number
}

const MIN_MATCHED_RUNS = 3

// Keyed by the activity object, so a new commit's runs start fresh and the old ones are collected.
const cellSetCache = new WeakMap<Activity, RouteCellSet>()

function cellSetFor(activity: Activity): RouteCellSet {
  let cellSet = cellSetCache.get(activity)
  if (!cellSet) {
    cellSet = buildRouteCellSet(activity.route ?? [])
    cellSetCache.set(activity, cellSet)
  }
  return cellSet
}

// By the activity list, the same array until the data changes: a run's group is worked out once per data, not per render.
const groups = new WeakMap<Activity[], Map<string, SimilarRunsData | null>>()

export function getSimilarRuns(activityId: string): SimilarRunsData | null {
  const activities = getAllActivities()
  let byId = groups.get(activities)
  if (!byId) groups.set(activities, (byId = new Map()))
  if (!byId.has(activityId)) byId.set(activityId, similarRuns(activities, activityId))
  return byId.get(activityId) ?? null
}

function similarRuns(activities: Activity[], activityId: string): SimilarRunsData | null {
  const current = activities.find((a) => a.id === activityId)
  if (!current?.route || current.route.length < 2 || current.paceSecPerKm == null) return null

  const currentCells = cellSetFor(current)

  const matched = activities.filter((a) => {
    if (a.id === current.id) return true
    if (!a.route || a.route.length < 2 || a.paceSecPerKm == null) return false
    if (!isSimilarDistance(a.distanceKm, current.distanceKm)) return false
    return routeSimilarity(cellSetFor(a), currentCells) >= SIMILAR_ROUTE_MIN_SIMILARITY
  })

  if (matched.length < MIN_MATCHED_RUNS) return null

  const byPace = [...matched].sort((a, b) => a.paceSecPerKm! - b.paceSecPerKm!)
  const rankById = new Map(byPace.map((a, i) => [a.id, i + 1]))

  const runs: SimilarRun[] = matched
    .map((a) => ({
      id: a.id,
      date: a.date,
      durationSeconds: a.durationSeconds,
      distanceKm: a.distanceKm,
      paceSecPerKm: a.paceSecPerKm!,
      rank: rankById.get(a.id)!,
      isCurrent: a.id === current.id,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    runs,
    count: matched.length,
    currentRank: rankById.get(current.id)!,
    bestPaceSecPerKm: byPace[0]!.paceSecPerKm!,
  }
}
