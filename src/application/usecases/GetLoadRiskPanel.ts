import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getLatestTrainingStatusDay } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { buildTimeSeries, dailyTrimpByDate, type HrBounds } from './GetTrainingLoad'
import { acwr } from './GetTrainingStatus'
import { addDays, isoDate } from '@/lib/calendarDate'
import { round } from '@/lib/math'

// 'low' is informational (undercharge); 'safe'/'caution'/'risk' is the actual risk ladder.
export type RiskZone = 'low' | 'safe' | 'caution' | 'risk'

export interface LoadRiskPanel {
  acwr: number | null
  acwrZone: RiskZone | null
  /** Where `acwr` came from - the watch's Firstbeat ratio, or our kilometre proxy. */
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

/** Foster monotony = mean(daily load, 7d) / stdev(daily load, 7d). Null when undefined (no variance or no load). */
export function monotony(last7DaysLoad: number[]): number | null {
  if (last7DaysLoad.length < 7) return null
  const mean = last7DaysLoad.reduce((s, v) => s + v, 0) / 7
  if (mean === 0) return null
  const variance = last7DaysLoad.reduce((s, v) => s + (v - mean) ** 2, 0) / 7
  const stdev = Math.sqrt(variance)
  if (stdev === 0) return null
  return round(mean / stdev, 2)
}

/** Foster strain = weekly load total x monotony. */
export function strain(weeklyLoad: number, monotonyValue: number): number {
  return round(weeklyLoad * monotonyValue, 0)
}

export function rampRate(ctlToday: number, ctl7dAgo: number): number {
  return round(ctlToday - ctl7dAgo, 1)
}

export function acwrZone(value: number | null): RiskZone | null {
  if (value === null) return null
  if (value > 1.5) return 'risk'
  if (value > 1.3) return 'caution'
  if (value >= 0.8) return 'safe'
  return 'low'
}

/**
 * The watch's own verdict on its ratio, mapped onto our ladder. Garmin grades
 * against a band it personalises per athlete, so its wording beats re-testing
 * the number against our generic thresholds; unrecognised phrasing falls back
 * to them.
 */
export function acwrZoneFromGarmin(status: string | null | undefined, value: number | null): RiskZone | null {
  switch (status) {
    case 'LOW': return 'low'
    case 'OPTIMAL': return 'safe'
    case 'HIGH': return 'caution'
    case 'VERY_HIGH': return 'risk'
    default: return acwrZone(value)
  }
}

export function monotonyZone(value: number | null): RiskZone | null {
  if (value === null) return null
  if (value > 2) return 'risk'
  if (value > 1.5) return 'caution'
  return 'safe'
}

const ZONE_SEVERITY: Record<RiskZone, number> = { low: 0, safe: 0, caution: 1, risk: 2 }

/** Strain has no direction of its own - it inherits the worse of ACWR/monotony's concern level. */
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
  const activities = getAllActivities() // sorted newest-first
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
    Math.round((refDate.getTime() - new Date(earliest.date + 'T00:00:00').getTime()) / 86_400_000) + 1

  // Same precedence as GetTrainingStatus: the watch computes the ratio on
  // Firstbeat load, where ours divides kilometres and reads a high-volume easy
  // week as overload. Letting the two disagree showed a different ACWR (and a
  // different verdict) on the dashboard and on this panel for the same day.
  const garmin = getLatestTrainingStatusDay()
  const localAcwr = acwr(activities, refDate)
  const useGarminAcwr = garmin?.acwr != null
  const acwrValue = useGarminAcwr ? garmin.acwr! : localAcwr
  const acwrZoneValue = useGarminAcwr
    ? acwrZoneFromGarmin(garmin.acwrStatus, acwrValue)
    : acwrZone(acwrValue)
  const acwrSource = acwrValue === null ? null : useGarminAcwr ? 'garmin' : 'local'

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
