import type { ActivityWeather } from '@/domain/activity/types'
import { compassPoint } from '@/domain/activity/weather'
import { t } from '@/i18n'
import { GARMIN_CONNECT_URL } from '@/lib/garminConnect'

/**
 * "18°C · wind 2 km/h N": the Conditions row of the verdict card (v4.8 2h).
 * The weather explains effort and heart rate, so it sits with them rather
 * than on the map. No wind reading, no wind: it printed "NaN km/h".
 */
export function conditionsText(weather: ActivityWeather): string {
  const parts = [`${Math.round(weather.tempC)}${t.units.celsius}`]
  if (Number.isFinite(weather.windKph)) {
    const dir = Number.isFinite(weather.windDirDeg) ? ` ${t.activity.weather.compass[compassPoint(weather.windDirDeg)]}` : ''
    parts.push(t.activity.conditions.wind(`${Math.round(weather.windKph)} ${t.units.kmh}${dir}`))
  }
  return parts.join(' · ')
}

/** Garmin Connect's page for one activity: where its shoe is set or changed. */
export function garminActivityUrl(activityId: string): string {
  return `${GARMIN_CONNECT_URL}/activity/${encodeURIComponent(activityId)}`
}
