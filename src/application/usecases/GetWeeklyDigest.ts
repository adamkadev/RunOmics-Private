import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'
import { getTrainingStatus, type TrainingStatus } from './GetTrainingStatus'
import { getLoadRiskPanel, type LoadRiskPanel } from './GetLoadRiskPanel'
import { getRecords, type RecordEntry } from './GetRecords'
import { easyHardShare } from '@/domain/training/easyHard'
import { addDays, daysElapsedInWeek, isoDate, isoWeekNumber } from '@/lib/calendarDate'
import { formatDuration } from '@/lib/formatters'
import { round } from '@/lib/math'
import { t } from '@/i18n'

const HARD_PCT_WATCH_THRESHOLD = 30
// Below this much logged time, one session's mix swings the hard-share % too
// far to mean anything (e.g. a single hard interval early in a taper week
// reads as "50% hard" even though the week is intentionally light).
const MIN_WEEKLY_SECONDS_FOR_HARD_SHARE = 90 * 60

export type DigestSeverity = 'positive' | 'watch'

export interface DigestFact {
  key: string
  severity: DigestSeverity
  text: string
}

export interface WeeklyTotals {
  weekNumber: number
  distanceKm: number
  sessions: number
  hardPct: number | null
}

export interface WeekRemainder {
  /** Days left before the week closes, today included. */
  days: number
  /** Planned sessions on those days that have not been run yet. */
  plannedSessions: number
}

export interface WeeklyDigest {
  totals: WeeklyTotals
  review: DigestFact[]
  remainder: WeekRemainder
  /** What the previous week finished on, as the bar this one is measured against. */
  lastWeek: Pick<WeeklyTotals, 'distanceKm' | 'sessions'> | null
}

export function weekRemainder(activities: Activity[], plannedDates: string[], now: Date): WeekRemainder {
  const days = 8 - daysElapsedInWeek(now)
  const remaining = new Set(Array.from({ length: days }, (_, i) => isoDate(addDays(now, i))))
  const ranDates = new Set(activities.map((a) => a.date.slice(0, 10)))

  return {
    days,
    plannedSessions: plannedDates.filter((date) => remaining.has(date) && !ranDates.has(date)).length,
  }
}

export function buildPrFacts(records: RecordEntry[], currentWeekNum: number): DigestFact[] {
  return records
    .filter((r) => r.seconds !== null && r.date && isoWeekNumber(new Date(r.date + 'T00:00:00')) === currentWeekNum)
    .map((r) => ({
      key: `pr-${r.key}`,
      severity: 'positive' as const,
      text: t.dashboard.weeklyDigest.newPr(r.label, formatDuration(r.seconds as number)),
    }))
}

export function buildStatusFact(status: TrainingStatus | null): DigestFact | null {
  if (status?.status === 'fresh') {
    return { key: 'status', severity: 'positive', text: t.dashboard.weeklyDigest.statusFresh(status.tsb) }
  }
  if (status?.status === 'overreaching') {
    return { key: 'status', severity: 'watch', text: t.dashboard.weeklyDigest.statusOverreaching(status.tsb) }
  }
  return null
}

export function buildLoadRiskFacts(loadRisk: LoadRiskPanel | null): DigestFact[] {
  if (!loadRisk) return []
  const facts: DigestFact[] = []
  if (loadRisk.acwr !== null && (loadRisk.acwrZone === 'risk' || loadRisk.acwrZone === 'caution')) {
    facts.push({ key: 'acwr', severity: 'watch', text: t.dashboard.weeklyDigest.acwrWatch(loadRisk.acwr) })
  }
  if (loadRisk.monotony !== null && (loadRisk.monotonyZone === 'risk' || loadRisk.monotonyZone === 'caution')) {
    facts.push({ key: 'monotony', severity: 'watch', text: t.dashboard.weeklyDigest.monotonyWatch(loadRisk.monotony) })
  }
  return facts
}

export function buildHardShareFact(hardPct: number | null): DigestFact | null {
  if (hardPct === null || hardPct <= HARD_PCT_WATCH_THRESHOLD) return null
  return { key: '8020', severity: 'watch', text: t.dashboard.weeklyDigest.hardShareWatch(hardPct) }
}

export async function getWeeklyDigest(now = new Date()): Promise<WeeklyDigest | null> {
  const activities: Activity[] = getAllActivities()
  const currentWeekNum = isoWeekNumber(now)
  const lastWeekActs = activities.filter((a) => a.week === isoWeekNumber(addDays(now, -7)))

  const [records, status, loadRisk] = await Promise.all([getRecords(), getTrainingStatus(), getLoadRiskPanel()])

  const currentWeekActs = activities.filter((a) => a.week === currentWeekNum)
  const { hardPct } = easyHardShare(currentWeekActs)
  const weeklySeconds = currentWeekActs.reduce((s, a) => s + a.durationSeconds, 0)
  const reliableHardPct = weeklySeconds >= MIN_WEEKLY_SECONDS_FOR_HARD_SHARE ? hardPct : null

  const review: DigestFact[] = [
    ...buildPrFacts(records, currentWeekNum),
    ...([buildStatusFact(status)].filter((f): f is DigestFact => f !== null)),
    ...buildLoadRiskFacts(loadRisk),
    ...([buildHardShareFact(reliableHardPct)].filter((f): f is DigestFact => f !== null)),
  ]

  // A week with nothing run and nothing flagged has no review to write.
  if (!review.length && currentWeekActs.length === 0) return null

  return {
    totals: {
      weekNumber: currentWeekNum,
      distanceKm: round(currentWeekActs.reduce((sum, a) => sum + a.distanceKm, 0), 1),
      sessions: currentWeekActs.length,
      hardPct: reliableHardPct,
    },
    review,
    remainder: weekRemainder(currentWeekActs, getAllPlannedWorkouts().map((w) => w.date), now),
    lastWeek: lastWeekActs.length
      ? {
          distanceKm: round(lastWeekActs.reduce((sum, a) => sum + a.distanceKm, 0), 1),
          sessions: lastWeekActs.length,
        }
      : null,
  }
}
