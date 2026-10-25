import type { ActivityWeather } from '@/domain/activity/types'
import { compassPoint, dewPointC, skyCondition } from '@/domain/activity/weather'
import { t } from '@/i18n'
import { GARMIN_CONNECT_URL } from '@/lib/garminConnect'

/** Feels-like this far from the air temperature changes how the run felt. */
export const FEELS_APART_C = 3
/** Runners feel the air as muggy from about this dew point on. */
export const MUGGY_DEW_POINT_C = 16

/**
 * ["Overcast · 24°C, feels 27°C", "70% humidity · wind 12 km/h SW"]: the extras only when they tell, and two chips
 * so neither wraps at 402 pt.
 */
export function conditionsChips(weather: ActivityWeather): string[] {
  const c = t.activity.conditions
  const sky = Number.isFinite(weather.code) ? skyCondition(weather.code) : null
  const temp = `${Math.round(weather.tempC)}${t.units.celsius}`
  const feels =
    Number.isFinite(weather.apparentTempC) && Math.abs(weather.apparentTempC - weather.tempC) >= FEELS_APART_C
      ? c.feels(`${Math.round(weather.apparentTempC)}${t.units.celsius}`)
      : null
  const air: string[] = []
  if (Number.isFinite(weather.humidityPct) && dewPointC(weather.tempC, weather.humidityPct) >= MUGGY_DEW_POINT_C) {
    air.push(c.humidity(Math.round(weather.humidityPct)))
  }
  if (Number.isFinite(weather.windKph)) {
    const dir = Number.isFinite(weather.windDirDeg) ? ` ${t.activity.weather.compass[compassPoint(weather.windDirDeg)]}` : ''
    air.push(c.wind(`${Math.round(weather.windKph)} ${t.units.kmh}${dir}`))
  }
  const first = [sky && t.activity.weather.conditions[sky], feels ? `${temp}, ${feels}` : temp].filter(Boolean).join(' · ')
  return air.length ? [first, air.join(' · ')] : [first]
}

/** Garmin Connect's page for one activity: where its shoe is set or changed. */
export function garminActivityUrl(activityId: string): string {
  return `${GARMIN_CONNECT_URL}/activity/${encodeURIComponent(activityId)}`
}
