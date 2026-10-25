import type { Activity, ScheduledTimeOfDay } from '@/domain/activity/types'
import { forecastAt, forecastPoint, usualRunHour, type HourlyForecast } from '@/domain/activity/heatAhead'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { fetchHourlyForecast } from '@/infrastructure/weather/OpenMeteoForecast'
import { heatBandOf, heatImpact, type HeatBandId } from './GetHeatImpact'

export interface HeatAhead {
  /** Feels-like, as the heat cost's own bands are. */
  apparentTempC: number
  hour: number
  costSecPerKm: number
}

const WARM_BANDS: readonly HeatBandId[] = ['warm', 'hot']

/** Under this the cost is within the day-to-day spread of an easy run's pace. */
const MIN_COST_SEC_PER_KM = 5

type FetchForecast = (lat: number, lon: number, date: string, timeZone: string) => Promise<HourlyForecast[] | null>

/**
 * What the forecast at the athlete's usual hour will cost them, in their own past runs' terms. Null whenever it
 * would not be worth a line: no warm band with enough runs, a cool forecast, or no forecast at all.
 */
export async function heatAhead(
  activities: readonly Activity[],
  today: string,
  scheduled: ScheduledTimeOfDay | undefined,
  fetchForecast: FetchForecast,
  timeZone: string,
): Promise<HeatAhead | null> {
  const impact = heatImpact([...activities])
  const costly = impact?.bands.filter((band) => WARM_BANDS.includes(band.id) && band.costSecPerKm >= MIN_COST_SEC_PER_KM) ?? []
  if (costly.length === 0) return null

  const hour = usualRunHour(activities, scheduled)
  const point = forecastPoint(activities)
  if (hour === null || !point) return null

  const forecast = await fetchForecast(point.lat, point.lon, today, timeZone)
  const at = forecast && forecastAt(forecast, today, hour)
  if (!at) return null

  const band = costly.find((b) => b.id === heatBandOf(at.apparentTempC))
  return band ? { apparentTempC: Math.round(at.apparentTempC), hour, costSecPerKm: band.costSecPerKm } : null
}

export function getHeatAhead(today: string, scheduled: ScheduledTimeOfDay | undefined): Promise<HeatAhead | null> {
  return heatAhead(getAllActivities(), today, scheduled, fetchHourlyForecast, process.env.NEXT_PUBLIC_TIME_ZONE || 'Europe/Paris')
}
