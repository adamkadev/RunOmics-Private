import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getTrainingLoad } from './GetTrainingLoad'
import { round } from '@/lib/math'

export type TrainingStatusType = 'productive' | 'fresh' | 'overreaching' | 'recovery' | 'detraining'
export type RiskLevel = 'low' | 'moderate' | 'high'
export type LoadTrend = 'building' | 'maintaining' | 'tapering' | 'detraining'

export interface TrainingStatus {
  status: TrainingStatusType
  risk: RiskLevel
  loadTrend: LoadTrend
  ctl: number
  atl: number
  tsb: number
  acwr: number | null
  ctlDelta: number
  ctlPeak: number
}

const DAY_MS = 86_400_000

export function acwr(activities: Activity[], refDate: Date): number | null {
  const ref = refDate.getTime()
  const kmInWindow = (days: number) =>
    activities
      .filter((a) => new Date(a.date + 'T00:00:00').getTime() >= ref - (days - 1) * DAY_MS)
      .reduce((s, a) => s + a.distanceKm, 0)

  const chronic = kmInWindow(28) / 4
  return chronic > 5 ? round(kmInWindow(7) / chronic, 2) : null
}

export function loadTrend(ctlDelta: number, tsb: number): LoadTrend {
  if (ctlDelta > 1.5) return 'building'
  if (ctlDelta < -1.5) return tsb > 0 ? 'tapering' : 'detraining'
  return 'maintaining'
}

export function classify(
  tsb: number,
  ctlDelta: number,
  ratio: number | null,
): { status: TrainingStatusType; risk: RiskLevel } {
  if (tsb < -30 || (ratio !== null && ratio > 1.5)) return { status: 'overreaching', risk: 'high' }
  if (tsb > 8 && ctlDelta >= -1) return { status: 'fresh', risk: 'low' }
  if (ctlDelta > 1.5) return { status: 'productive', risk: tsb < -20 ? 'moderate' : 'low' }
  if (ctlDelta < -2 && tsb < 3) return { status: 'detraining', risk: 'low' }
  if (tsb > 0 && ctlDelta < -1) return { status: 'recovery', risk: 'low' }
  return { status: 'productive', risk: ratio !== null && ratio > 1.3 ? 'moderate' : 'low' }
}

export async function getTrainingStatus(): Promise<TrainingStatus | null> {
  const load = await getTrainingLoad()
  if (!load) return null

  const { ctl, atl, tsb, points } = load
  const prevPoint = points.length >= 15 ? points[points.length - 15] : points[0]
  if (!prevPoint) return null
  const ctlDelta = round(ctl - prevPoint.ctl, 1)

  const activities = getAllActivities()
  const firstActivity = activities[0]
  if (!firstActivity) return null
  const refDate = new Date(firstActivity.date + 'T00:00:00')
  const ratio = acwr(activities, refDate)

  const { status, risk } = classify(tsb, ctlDelta, ratio)
  const ctlPeak = points.reduce((max, p) => Math.max(max, p.ctl), ctl)

  return { status, risk, loadTrend: loadTrend(ctlDelta, tsb), ctl, atl, tsb, acwr: ratio, ctlDelta, ctlPeak }
}
