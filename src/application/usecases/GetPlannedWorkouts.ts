import fs from 'fs'
import path from 'path'
import type { Activity, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { trimp, type HrBounds } from './GetTrainingLoad'
import { isoDate } from '@/lib/calendarDate'
import { round } from '@/lib/math'

// Flat duration assumed for a planned workout that has neither a duration nor
// a distance (e.g. interval sessions like "6 x 1000m") and whose type has no
// history to fall back on either.
const FALLBACK_DURATION_MINUTES = 40

export interface TypeLoadStats {
  trimpPerMinute: number
  paceSecPerKm: number
  avgDurationMinutes: number
}

function computeStats(activities: Activity[], hrBounds?: HrBounds): TypeLoadStats | null {
  const withDuration = activities.filter((a) => a.durationSeconds > 0)
  if (!withDuration.length) return null

  let totalTrimp = 0
  let totalMinutes = 0
  let totalKm = 0
  let totalSecondsForPace = 0

  for (const a of withDuration) {
    totalTrimp += trimp(a, hrBounds)
    totalMinutes += a.durationSeconds / 60
    if (a.distanceKm > 0) {
      totalKm += a.distanceKm
      totalSecondsForPace += a.durationSeconds
    }
  }
  if (totalMinutes <= 0) return null

  return {
    trimpPerMinute: totalTrimp / totalMinutes,
    paceSecPerKm: totalKm > 0 ? totalSecondsForPace / totalKm : 0,
    avgDurationMinutes: totalMinutes / withDuration.length,
  }
}

/** Per-type TRIMP/minute, pace and average duration derived from completed activities, plus an all-type fallback. */
export function buildTypeLoadStats(
  activities: Activity[],
  hrBounds?: HrBounds,
): { byType: Partial<Record<ActivityType, TypeLoadStats>>; overall: TypeLoadStats } {
  const byType: Partial<Record<ActivityType, TypeLoadStats>> = {}
  for (const type of new Set(activities.map((a) => a.type))) {
    const stats = computeStats(activities.filter((a) => a.type === type), hrBounds)
    if (stats) byType[type] = stats
  }

  const overall = computeStats(activities, hrBounds) ?? {
    trimpPerMinute: 0,
    paceSecPerKm: 0,
    avgDurationMinutes: FALLBACK_DURATION_MINUTES,
  }

  return { byType, overall }
}

function estimateMinutes(workout: PlannedWorkout, stats: TypeLoadStats): number {
  if (workout.durationSecs) return workout.durationSecs / 60
  if (workout.distanceM && stats.paceSecPerKm > 0) return ((workout.distanceM / 1000) * stats.paceSecPerKm) / 60
  return stats.avgDurationMinutes || FALLBACK_DURATION_MINUTES
}

/** Estimates a planned (not-yet-run) workout's TRIMP from historical load for its type - always marked `isEstimated`. */
export function estimatePlannedLoad(
  workout: PlannedWorkout,
  byType: Partial<Record<ActivityType, TypeLoadStats>>,
  overall: TypeLoadStats,
): PlannedWorkout {
  const stats = (workout.type && byType[workout.type]) || overall
  const minutes = estimateMinutes(workout, stats)
  return { ...workout, estimatedLoad: round(stats.trimpPerMinute * minutes, 0), isEstimated: true }
}

function readPlannedWorkoutsFile(): PlannedWorkout[] {
  const filePath = path.join(process.cwd(), 'public', 'data', 'planned_workouts.json')
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as { planned: PlannedWorkout[] }
  return parsed.planned
}

export async function getPlannedWorkouts(): Promise<PlannedWorkout[]> {
  const planned = readPlannedWorkoutsFile()
  if (!planned.length) return planned

  const activities = getAllActivities()
  const athlete = await getAthleteFromFirestore()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  const { byType, overall } = buildTypeLoadStats(activities, hrBounds)
  return planned.map((w) => estimatePlannedLoad(w, byType, overall))
}

/** Today's planned workout, if Garmin has one scheduled. */
export async function getTodayPlannedWorkout(): Promise<PlannedWorkout | null> {
  const planned = await getPlannedWorkouts()
  const today = isoDate(new Date())
  return planned.find((w) => w.date === today) ?? null
}
