import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { latestLoadPair, loadRatio } from '@/domain/training/loadTrend'
import { getLoadPairs } from './GetLoadRecovery'
import { buildTimeSeries, dailyTrimpByDate, type HrBounds } from './GetTrainingLoad'
import { acwr } from './GetTrainingStatus'
import { DAY_MS, addDays, isoDate } from '@/lib/calendarDate'
import { round } from '@/lib/math'

export type RiskZone = 'low' | 'safe' | 'caution' | 'risk'

export interface LoadRiskPanel {
  acwr: number | null
  /** The pair the ratio is worked out from, printed beside it so the two can't disagree. */
  acute: number | null
  chronic: number | null
  acwrZone: RiskZone | null
  acwrSource: 'garmin' | 'local' | null
  monotony: number | null
  monotonyZone: RiskZone | null
  strain: number | null
  strainZone: 'safe' | 'caution' | 'risk' | null
  rampRate: number | null
  rampRateZone: RiskZone | null
  daysOfHistory: number
}

const MIN_DAYS_FOR_WEEKLY_METRICS = 7

export function monotony(last7DaysLoad: number[]): number | null {
  if (last7DaysLoad.length < 7) return null
  const mean = last7DaysLoad.reduce((s, v) => s + v, 0) / 7
  if (mean === 0) return null
  const variance = last7DaysLoad.reduce((s, v) => s + (v - mean) ** 2, 0) / 7
  const stdev = Math.sqrt(variance)
  if (stdev === 0) return null
  return round(mean / stdev, 2)
}

export function strain(weeklyLoad: number, monotonyValue: number): number {
  return round(weeklyLoad * monotonyValue, 0)
}

export function rampRate(ctlToday: number, ctl7dAgo: number): number {
  return round(ctlToday - ctl7dAgo, 1)
}

export function acwrFromPair(acute: number | null | undefined, chronic: number | null | undefined): number | null {
  if (acute == null || chronic == null || !(chronic > 0)) return null
  return round(acute / chronic, 2)
}

export function acwrZone(value: number | null): RiskZone | null {
  if (value === null) return null
  if (value > 1.5) return 'risk'
  if (value > 1.3) return 'caution'
  if (value >= 0.8) return 'safe'
  return 'low'
}

export function monotonyZone(value: number | null): RiskZone | null {
  if (value === null) return null
  if (value > 2) return 'risk'
  if (value > 1.5) return 'caution'
  return 'safe'
}

const ZONE_SEVERITY: Record<RiskZone, number> = { low: 0, safe: 0, caution: 1, risk: 2 }

export function strainZone(
  acwrZoneValue: RiskZone | null,
  monotonyZoneValue: RiskZone | null,
): 'safe' | 'caution' | 'risk' | null {
  const zones = [acwrZoneValue, monotonyZoneValue].filter((z): z is RiskZone => z !== null)
  if (!zones.length) return null
  const maxSeverity = Math.max(...zones.map((z) => ZONE_SEVERITY[z]))
  return maxSeverity === 2 ? 'risk' : maxSeverity === 1 ? 'caution' : 'safe'
}

export function rampRateZone(value: number): RiskZone {
  const abs = Math.abs(value)
  if (abs > 8) return 'risk'
  if (abs > 5) return 'caution'
  return 'safe'
}

export async function getLoadRiskPanel(): Promise<LoadRiskPanel | null> {
  const activities = getAllActivities()
  const latest = activities[0]
  const earliest = activities[activities.length - 1]
  if (!latest || !earliest) return null

  const athlete = getAthleteProfile()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  const refDate = new Date(latest.date + 'T00:00:00')
  const daysOfHistory =
    Math.round((refDate.getTime() - new Date(earliest.date + 'T00:00:00').getTime()) / DAY_MS) + 1

  // From the pair Load trend plots: Garmin's own acwr field disagrees with its
  // loads (0.8 beside 412 and 295).
  const pair = latestLoadPair(getLoadPairs())
  const pairAcwr = pair ? loadRatio(pair) : null
  const localAcwr = acwr(activities, refDate)
  const acwrValue = pairAcwr ?? localAcwr
  const acwrZoneValue = acwrZone(acwrValue)
  const acwrSource = acwrValue === null ? null : pairAcwr !== null ? 'garmin' : 'local'

  let monotonyValue: number | null = null
  let strainValue: number | null = null
  let monotonyZoneValue: RiskZone | null = null

  if (daysOfHistory >= MIN_DAYS_FOR_WEEKLY_METRICS) {
    const dailyLoad = dailyTrimpByDate(activities, hrBounds)
    const last7DaysLoad = Array.from({ length: 7 }, (_, i) => dailyLoad.get(isoDate(addDays(refDate, -i))) ?? 0)
    monotonyValue = monotony(last7DaysLoad)
    monotonyZoneValue = monotonyZone(monotonyValue)
    if (monotonyValue !== null) {
      const weeklyLoad = round(last7DaysLoad.reduce((s, v) => s + v, 0), 0)
      strainValue = strain(weeklyLoad, monotonyValue)
    }
  }

  let rampRateValue: number | null = null
  let rampRateZoneValue: RiskZone | null = null
  if (daysOfHistory >= MIN_DAYS_FOR_WEEKLY_METRICS) {
    const series = buildTimeSeries(activities, hrBounds)
    const entries = Array.from(series.values())
    const today = entries[entries.length - 1]
    const sevenDaysAgo = entries[entries.length - 8]
    if (today && sevenDaysAgo) {
      rampRateValue = rampRate(today.ctl, sevenDaysAgo.ctl)
      rampRateZoneValue = rampRateZone(rampRateValue)
    }
  }

  return {
    acwr: acwrValue,
    acute: pair?.acute ?? null,
    chronic: pair?.chronic ?? null,
    acwrZone: acwrZoneValue,
    acwrSource,
    monotony: monotonyValue,
    monotonyZone: monotonyZoneValue,
    strain: strainValue,
    strainZone: strainZone(acwrZoneValue, monotonyZoneValue),
    rampRate: rampRateValue,
    rampRateZone: rampRateZoneValue,
    daysOfHistory,
  }
}
