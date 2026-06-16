import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getFullLoadHistory } from './GetTrainingLoad'
import { round } from '@/lib/math'
import type { ActivityType } from '@/domain/activity/types'

const DAY_MS = 86_400_000

export type SuggestionKey =
  | 'reduce_load'
  | 'fatigue_high'
  | 'easy_session'
  | 'quality_window'
  | 'add_sessions'
  | 'increase_volume'
  | 'maintain'

export interface CoachSuggestion {
  key: SuggestionKey
  acwr?: number
}

export interface CoachWeek {
  distanceKm: number
  sessions: number
  deltaDistancePct: number | null
  deltaSessions: number | null
}

export interface CoachLoadDelta {
  ctl: number
  atl: number
  tsb: number
  ctlDelta7d: number
  atlDelta7d: number
  tsbDelta7d: number
}

export interface CoachRecentActivity {
  id: string
  date: string
  type: ActivityType
  distanceKm: number
  durationSeconds: number
  paceSecPerKm: number | null
}

export interface CoachYearOverYear {
  deltaDistancePct: number | null
  deltaSessions: number | null
}

export interface CoachTypeBreakdown {
  type: ActivityType
  sessions: number
  distanceKm: number
}

export interface CoachData {
  week: CoachWeek
  loadDelta: CoachLoadDelta
  yearOverYear: CoachYearOverYear | null
  sessionTypeBreakdown: CoachTypeBreakdown[]
  suggestions: CoachSuggestion[]
  recentActivities: CoachRecentActivity[]
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getCoachData(): CoachData | null {
  const activities = getAllActivities()
  if (!activities.length) return null

  const history = getFullLoadHistory()
  if (!history.size) return null

  // Anchor to most recent activity (compatible with static data)
  const latestDate = activities.reduce((max, a) => (a.date > max ? a.date : max), activities[0].date)
  const refDate = new Date(latestDate + 'T00:00:00')
  const refTime = refDate.getTime()

  const kmInWindow = (days: number) =>
    activities
      .filter((a) => refTime - new Date(a.date + 'T00:00:00').getTime() <= (days - 1) * DAY_MS)
      .reduce((s, a) => s + a.distanceKm, 0)

  // Current week (last 7 days) vs previous 7 days
  const actsLast7 = activities.filter(
    (a) => refTime - new Date(a.date + 'T00:00:00').getTime() <= 6 * DAY_MS,
  )
  const actsPrev7 = activities.filter((a) => {
    const diff = refTime - new Date(a.date + 'T00:00:00').getTime()
    return diff > 6 * DAY_MS && diff <= 13 * DAY_MS
  })

  const currentKm = round(actsLast7.reduce((s, a) => s + a.distanceKm, 0), 1)
  const prevKm = round(actsPrev7.reduce((s, a) => s + a.distanceKm, 0), 1)

  // Same 7-day window 52 weeks ago (weekday-aligned), only if history reaches back that far
  const lastYearRefTime = refTime - 364 * DAY_MS
  const earliestDate = activities.reduce((min, a) => (a.date < min ? a.date : min), activities[0].date)
  const earliestTime = new Date(earliestDate + 'T00:00:00').getTime()
  const hasYearHistory = earliestTime <= lastYearRefTime - 6 * DAY_MS

  const actsLastYear = hasYearHistory
    ? activities.filter((a) => {
        const diff = lastYearRefTime - new Date(a.date + 'T00:00:00').getTime()
        return diff >= 0 && diff <= 6 * DAY_MS
      })
    : []
  const lastYearKm = round(actsLastYear.reduce((s, a) => s + a.distanceKm, 0), 1)

  const yearOverYear: CoachYearOverYear | null = hasYearHistory
    ? {
        deltaDistancePct: lastYearKm > 0 ? round(((currentKm - lastYearKm) / lastYearKm) * 100) : null,
        deltaSessions: actsLastYear.length > 0 ? actsLast7.length - actsLastYear.length : null,
      }
    : null

  // Distance/sessions per activity type for the current week
  const typeTotals = new Map<ActivityType, { sessions: number; distanceKm: number }>()
  for (const a of actsLast7) {
    const entry = typeTotals.get(a.type) ?? { sessions: 0, distanceKm: 0 }
    entry.sessions += 1
    entry.distanceKm += a.distanceKm
    typeTotals.set(a.type, entry)
  }
  const sessionTypeBreakdown: CoachTypeBreakdown[] = [...typeTotals.entries()]
    .map(([type, v]) => ({ type, sessions: v.sessions, distanceKm: round(v.distanceKm, 1) }))
    .sort((a, b) => b.distanceKm - a.distanceKm)

  // Current load snapshot (today)
  const todaySnap = history.get(isoDate(refDate)) ?? history.get([...history.keys()].at(-1)!)!
  const { ctl, atl, tsb } = todaySnap

  // 7-day-ago snapshot for deltas
  const ago7Date = new Date(refTime - 7 * DAY_MS)
  const snap7 = history.get(isoDate(ago7Date)) ?? todaySnap

  // ACWR (km-based, 7d acute / 28d chronic average)
  const chronic = kmInWindow(28) / 4
  const acwr = chronic > 5 ? round(kmInWindow(7) / chronic, 2) : null

  // Suggestions (ordered by severity, max 3)
  const suggestions: CoachSuggestion[] = []

  if (acwr !== null && acwr > 1.5) {
    suggestions.push({ key: 'reduce_load', acwr })
  } else if (tsb < -20) {
    suggestions.push({ key: 'fatigue_high' })
  } else if (acwr !== null && acwr > 1.1 && tsb < -10) {
    suggestions.push({ key: 'easy_session' })
  }

  if (tsb > 8 && ctl > 35) {
    suggestions.push({ key: 'quality_window' })
  }

  if (round(ctl - snap7.ctl, 1) < -2 && tsb < 5) {
    suggestions.push({ key: 'add_sessions' })
  } else if (acwr !== null && acwr < 0.7 && chronic > 5) {
    suggestions.push({ key: 'increase_volume' })
  }

  if (suggestions.length === 0) {
    suggestions.push({ key: 'maintain' })
  }

  return {
    week: {
      distanceKm: currentKm,
      sessions: actsLast7.length,
      deltaDistancePct: prevKm > 0 ? round(((currentKm - prevKm) / prevKm) * 100) : null,
      deltaSessions: actsPrev7.length > 0 ? actsLast7.length - actsPrev7.length : null,
    },
    loadDelta: {
      ctl,
      atl,
      tsb,
      ctlDelta7d: round(ctl - snap7.ctl, 1),
      atlDelta7d: round(atl - snap7.atl, 1),
      tsbDelta7d: round(tsb - snap7.tsb, 1),
    },
    yearOverYear,
    sessionTypeBreakdown,
    suggestions: suggestions.slice(0, 3),
    recentActivities: actsLast7
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((a) => ({
        id: a.id,
        date: a.date,
        type: a.type,
        distanceKm: a.distanceKm,
        durationSeconds: a.durationSeconds,
        paceSecPerKm: a.paceSecPerKm,
      })),
  }
}
