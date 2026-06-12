import fs from 'fs'
import path from 'path'
import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'

export interface PbEntry {
  distance: string
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

export interface PbData {
  entry: PbEntry
  activity: Activity
  photoPath: string | null
}

export interface YearData {
  year: number
  totalDistanceKm: number
  goals: GoalYear | null
  pbs: PbData[]
}

export interface GoalsPageData {
  years: number[]
  byYear: Record<number, YearData>
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', file), 'utf-8')) as T
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

export function getGoalsPageData(): GoalsPageData {
  const activities = getAllActivities()
  const goalYears = readJson<GoalYear[]>('goals.json')
  const pbYears = readJson<PbYear[]>('pbs.json')

  const activityMap = new Map(activities.map((a) => [a.id, a]))

  const allYears = Array.from(
    new Set([...goalYears.map((g) => g.year), ...pbYears.map((p) => p.year)])
  ).sort((a, b) => b - a)

  const byYear: Record<number, YearData> = {}

  for (const year of allYears) {
    const goals = goalYears.find((g) => g.year === year) ?? null
    const pbYear = pbYears.find((p) => p.year === year)

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

    byYear[year] = { year, totalDistanceKm, goals, pbs }
  }

  return { years: allYears, byYear }
}
