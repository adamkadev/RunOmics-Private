import fs from 'fs'
import path from 'path'
import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import {
  getGoalsFromFirestore,
  getPbsFromFirestore,
  getUpcomingRacesFromFirestore,
} from '@/infrastructure/repositories/FirestoreConfigRepository'
import { round } from '@/lib/math'

export interface PbEntry {
  distance: string
  seconds: number
  activityId: string
}

export interface PbYear {
  year: number
  entries: PbEntry[]
}

export interface GoalTarget {
  distance: string
  targetSeconds: number | null
}

export interface GoalYear {
  year: number
  annualDistanceKm: number
  targets: GoalTarget[]
}

export interface UpcomingRace {
  date: string
  name: string
  distance: string
  location?: string
  url?: string
  targetSeconds?: number | null
}

export interface UpcomingRaceYear {
  year: number
  races: UpcomingRace[]
}

export interface PbData {
  entry: PbEntry
  activity: Activity
  photoPath: string | null
}

export interface GoalProjection {
  weeklyRate: number
  weeklyNeeded: number
  projectedYearKm: number
  status: 'ahead' | 'on_track' | 'behind'
  deltaKm: number
}

export interface YearData {
  year: number
  totalDistanceKm: number
  goals: GoalYear | null
  pbs: PbData[]
  upcomingRaces: UpcomingRace[]
  projection: GoalProjection | null
}

export interface GoalsPageData {
  years: number[]
  byYear: Record<number, YearData>
}

function eventPhotoPath(activityId: string): string | null {
  const publicDir = path.join(process.cwd(), 'public', 'events')
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'avif']) {
    if (fs.existsSync(path.join(publicDir, `${activityId}.${ext}`))) {
      return `/events/${activityId}.${ext}`
    }
  }
  return null
}

// Uses last 8 calendar weeks (cross-year safe) for a stable rate.
// Requires >= 4 weeks elapsed in the current year before projecting.
function computeProjection(
  activities: Activity[],
  year: number,
  totalDistanceKm: number,
  goals: GoalYear,
): GoalProjection | null {
  const goal = goals.annualDistanceKm
  if (goal <= 0 || totalDistanceKm >= goal) return null

  const now = new Date()
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)
  const weeksElapsed = (now.getTime() - yearStart.getTime()) / (7 * 86_400_000)
  const remainingWeeks = (yearEnd.getTime() - now.getTime()) / (7 * 86_400_000)

  if (weeksElapsed < 4 || remainingWeeks <= 0) return null

  // Rolling 8-week rate: uses all activities (not filtered by year) for cross-year accuracy
  const cutoff = new Date(now.getTime() - 56 * 86_400_000)
  const recentKm = activities
    .filter((a) => new Date(a.date + 'T00:00:00') >= cutoff)
    .reduce((s, a) => s + a.distanceKm, 0)
  const weeklyRate = round(recentKm / 8, 1)

  const weeklyNeeded = round((goal - totalDistanceKm) / remainingWeeks, 1)
  const projectedYearKm = Math.round(totalDistanceKm + weeklyRate * remainingWeeks)
  const deltaKm = Math.abs(projectedYearKm - goal)

  const status: GoalProjection['status'] =
    weeklyRate > weeklyNeeded * 1.1 ? 'ahead' :
    weeklyRate < weeklyNeeded * 0.9 ? 'behind' : 'on_track'

  return { weeklyRate, weeklyNeeded, projectedYearKm, status, deltaKm }
}

export async function getGoalsPageData(): Promise<GoalsPageData> {
  const activities = getAllActivities()
  const [goalYears, pbYears, upcomingRaceYears] = await Promise.all([
    getGoalsFromFirestore(),
    getPbsFromFirestore(),
    getUpcomingRacesFromFirestore(),
  ])

  const activityMap = new Map(activities.map((a) => [a.id, a]))

  const allYears = Array.from(
    new Set([
      ...goalYears.map((g) => g.year),
      ...pbYears.map((p) => p.year),
      ...upcomingRaceYears.map((u) => u.year),
    ])
  ).sort((a, b) => b - a)

  const currentYear = new Date().getFullYear()
  const byYear: Record<number, YearData> = {}

  for (const year of allYears) {
    const goals = goalYears.find((g) => g.year === year) ?? null
    const pbYear = pbYears.find((p) => p.year === year)
    const upcomingRaces = (upcomingRaceYears.find((u) => u.year === year)?.races ?? [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))

    const pbs: PbData[] = (pbYear?.entries ?? [])
      .map((entry) => {
        const activity = activityMap.get(entry.activityId)
        if (!activity) return null
        return { entry, activity, photoPath: eventPhotoPath(entry.activityId) }
      })
      .filter((x): x is PbData => x !== null)

    const totalDistanceKm = activities
      .filter((a) => a.date.startsWith(String(year)))
      .reduce((sum, a) => sum + a.distanceKm, 0)

    const projection =
      year === currentYear && goals
        ? computeProjection(activities, year, totalDistanceKm, goals)
        : null

    byYear[year] = { year, totalDistanceKm, goals, pbs, upcomingRaces, projection }
  }

  return { years: allYears, byYear }
}
