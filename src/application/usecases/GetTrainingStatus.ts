import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getLatestTrainingStatusDay } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { getTrainingLoad, ATL_DAYS } from './GetTrainingLoad'
import { round } from '@/lib/math'

export type TrainingStatusType =
  | 'productive'
  | 'fresh'
  | 'overreaching'
  | 'recovery'
  | 'detraining'
  | 'maintaining'
  | 'unproductive'
export type RiskLevel = 'low' | 'moderate' | 'high'
export type LoadTrend = 'building' | 'maintaining' | 'tapering' | 'detraining'

export interface TrainingStatus {
  status: TrainingStatusType
  risk: RiskLevel
  loadTrend: LoadTrend
  ctl: number
  atl: number
  tsb: number
  tsbNow: number
  acwr: number | null
  ctlDelta: number
  atlDelta: number
  tsbDelta: number
  ctlPeak: number
  source: 'garmin' | 'local'
  acwrStatus: string | null
  chronicLoad: number | null
  chronicLoadMin: number | null
  chronicLoadMax: number | null
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

const GARMIN_STATUS: Record<string, TrainingStatusType> = {
  productive: 'productive',
  maintaining: 'maintaining',
  recovery: 'recovery',
  detraining: 'detraining',
  overreaching: 'overreaching',
  unproductive: 'unproductive',
  peaking: 'fresh',
}

export function garminStatusType(raw: string | null | undefined): TrainingStatusType | null {
  return raw ? (GARMIN_STATUS[raw] ?? null) : null
}

export function riskFromGarmin(status: TrainingStatusType, acwrStatus: string | null): RiskLevel {
  if (status === 'overreaching') return 'high'
  if (status === 'unproductive' || acwrStatus === 'HIGH') return 'moderate'
  return 'low'
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

  const { ctl, atl, tsb, tsbNow, points } = load
  const prevPoint = points.length >= 15 ? points[points.length - 15] : points[0]
  if (!prevPoint) return null
  const ctlDelta = round(ctl - prevPoint.ctl, 1)

  const atlPrevPoint = points.length >= ATL_DAYS + 1 ? points[points.length - (ATL_DAYS + 1)] : points[0]
  if (!atlPrevPoint) return null
  const atlDelta = round(atl - atlPrevPoint.atl, 1)

  const weekAgo = points.length >= 8 ? points[points.length - 8] : points[0]
  const tsbDelta = round(tsbNow - (weekAgo?.tsb ?? tsbNow), 1)

  const activities = getAllActivities()
  const firstActivity = activities[0]
  if (!firstActivity) return null
  const refDate = new Date(firstActivity.date + 'T00:00:00')

  const garmin = getLatestTrainingStatusDay()
  const garminType = garminStatusType(garmin?.status) ?? undefined

  const localRatio = acwr(activities, refDate)
  const local = classify(tsb, ctlDelta, localRatio)
  const useGarmin = garminType !== undefined
  const ratio = useGarmin ? (garmin?.acwr ?? null) : localRatio
  const status = garminType ?? local.status
  const risk = useGarmin ? riskFromGarmin(status, garmin?.acwrStatus ?? null) : local.risk

  const ctlPeak = points.reduce((max, p) => Math.max(max, p.ctl), ctl)

  return {
    status,
    risk,
    loadTrend: loadTrend(ctlDelta, tsb),
    ctl,
    atl,
    tsb,
    tsbNow,
    acwr: ratio,
    ctlDelta,
    atlDelta,
    tsbDelta,
    ctlPeak,
    source: useGarmin ? 'garmin' : 'local',
    acwrStatus: garmin?.acwrStatus ?? null,
    chronicLoad: garmin?.chronicLoad ?? null,
    chronicLoadMin: garmin?.chronicLoadMin ?? null,
    chronicLoadMax: garmin?.chronicLoadMax ?? null,
  }
}
