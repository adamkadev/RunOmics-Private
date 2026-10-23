import type { ActivityWeather } from '@/domain/activity/types'
import { compassPoint } from '@/domain/activity/weather'
import { t } from '@/i18n'
import { GARMIN_CONNECT_URL } from '@/lib/garminConnect'

/** "18°C · wind 2 km/h N"; with no wind reading, no wind rather than "NaN km/h". */
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
