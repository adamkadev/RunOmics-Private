import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getTrainingStatus, type TrainingStatus } from './GetTrainingStatus'
import { getLoadRiskPanel, type LoadRiskPanel } from './GetLoadRiskPanel'
import { getRecords, type RecordEntry } from './GetRecords'
import { easyHardShare } from '@/domain/training/easyHard'
import { isoWeekNumber } from '@/lib/calendarDate'
import { formatDuration } from '@/lib/formatters'
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

export interface WeeklyDigest {
  review: DigestFact[]
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

export async function getWeeklyDigest(): Promise<WeeklyDigest | null> {
  const activities: Activity[] = getAllActivities()
  const currentWeekNum = isoWeekNumber(new Date())

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

  if (!review.length) return null
  return { review }
}
