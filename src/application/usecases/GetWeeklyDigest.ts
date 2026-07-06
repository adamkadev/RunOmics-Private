import type { Activity, PlannedWorkout } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getTrainingStatus, type TrainingStatus } from './GetTrainingStatus'
import { getLoadRiskPanel, type LoadRiskPanel } from './GetLoadRiskPanel'
import { getRecords, type RecordEntry } from './GetRecords'
import { getPlannedWorkouts } from './GetPlannedWorkouts'
import { getNextRace } from './GetNextRace'
import type { UpcomingRace } from './GetGoalsData'
import { easyHardShare } from '@/domain/training/easyHard'
import { isoWeekNumber, isoDate } from '@/lib/calendarDate'
import { formatDuration, formatDayMonth } from '@/lib/formatters'
import { t } from '@/i18n'

const HARD_PCT_WATCH_THRESHOLD = 30

export type DigestSeverity = 'positive' | 'watch'

export interface DigestFact {
  key: string
  severity: DigestSeverity
  text: string
}

export interface WeeklyDigest {
  review: DigestFact[]
  comingUp: DigestFact[]
}

export function daysUntil(date: string, today: string): number {
  return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000)
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

export function buildNextRaceFact(nextRace: UpcomingRace | null, today: string): DigestFact | null {
  if (!nextRace) return null
  return { key: 'race', severity: 'positive', text: t.dashboard.weeklyDigest.nextRace(nextRace.name, daysUntil(nextRace.date, today)) }
}

export function buildNextKeySessionFact(planned: PlannedWorkout[], today: string): DigestFact | null {
  const next = planned
    .filter((p) => p.date >= today && p.type && p.type !== 'Base')
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  if (!next?.type) return null
  return {
    key: 'next-key',
    severity: 'positive',
    text: t.dashboard.weeklyDigest.nextKeySession(t.activityTypes[next.type], formatDayMonth(next.date)),
  }
}

export async function getWeeklyDigest(): Promise<WeeklyDigest | null> {
  const activities: Activity[] = getAllActivities()
  const currentWeekNum = isoWeekNumber(new Date())
  const today = isoDate(new Date())

  const [records, status, loadRisk, nextRace, planned] = await Promise.all([
    getRecords(),
    getTrainingStatus(),
    getLoadRiskPanel(),
    getNextRace(),
    getPlannedWorkouts(),
  ])

  const currentWeekActs = activities.filter((a) => a.week === currentWeekNum)
  const { hardPct } = easyHardShare(currentWeekActs)

  const review: DigestFact[] = [
    ...buildPrFacts(records, currentWeekNum),
    ...([buildStatusFact(status)].filter((f): f is DigestFact => f !== null)),
    ...buildLoadRiskFacts(loadRisk),
    ...([buildHardShareFact(hardPct)].filter((f): f is DigestFact => f !== null)),
  ]

  const comingUp: DigestFact[] = [buildNextRaceFact(nextRace, today), buildNextKeySessionFact(planned, today)].filter(
    (f): f is DigestFact => f !== null,
  )

  if (!review.length && !comingUp.length) return null
  return { review, comingUp }
}
