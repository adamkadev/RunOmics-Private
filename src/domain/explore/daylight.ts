const RAD = Math.PI / 180
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000
/** The sun's upper limb at the horizon, refraction included: NOAA's −0.833°. */
const ZENITH_DEG = 90.833

/** A run that ends this close to sunset is already in the woods' dusk. */
export const DUSK_MARGIN_MIN = 15

export type SunTimes = { sunrise: number; sunset: number } | { polar: 'day' | 'night' }

/** NOAA's solar calculator equations (after Meeus), in epoch ms; within a minute or two at mid latitudes. */
export function sunTimes(date: string, lat: number, lon: number): SunTimes {
  const midnight = Date.parse(`${date}T00:00:00Z`)
  const jc = (midnight / DAY_MS + 2440587.5 + 0.5 - 2451545) / 36525
  const meanLong = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360
  const meanAnom = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)
  const eccent = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)
  const centre =
    Math.sin(meanAnom * RAD) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin(2 * meanAnom * RAD) * (0.019993 - 0.000101 * jc) +
    Math.sin(3 * meanAnom * RAD) * 0.000289
  const omega = 125.04 - 1934.136 * jc
  const apparentLong = meanLong + centre - 0.00569 - 0.00478 * Math.sin(omega * RAD)
  const meanObliq = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
  const obliq = meanObliq + 0.00256 * Math.cos(omega * RAD)
  const decl = Math.asin(Math.sin(obliq * RAD) * Math.sin(apparentLong * RAD))
  const y = Math.tan((obliq / 2) * RAD) ** 2
  const eqTimeMin =
    (4 / RAD) *
    (y * Math.sin(2 * meanLong * RAD) -
      2 * eccent * Math.sin(meanAnom * RAD) +
      4 * eccent * y * Math.sin(meanAnom * RAD) * Math.cos(2 * meanLong * RAD) -
      0.5 * y * y * Math.sin(4 * meanLong * RAD) -
      1.25 * eccent * eccent * Math.sin(2 * meanAnom * RAD))

  const cosHourAngle = Math.cos(ZENITH_DEG * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl)
  if (cosHourAngle > 1) return { polar: 'night' }
  if (cosHourAngle < -1) return { polar: 'day' }
  const hourAngleMin = (4 * Math.acos(cosHourAngle)) / RAD
  const noonMin = 720 - 4 * lon - eqTimeMin
  return {
    sunrise: midnight + (noonMin - hourAngleMin) * MINUTE_MS,
    sunset: midnight + (noonMin + hourAngleMin) * MINUTE_MS,
  }
}

export type Darkness = { kind: 'dusk'; at: number } | { kind: 'dawn'; at: number } | { kind: 'night' } | null

/** Whether a run from `now` for `durationS` starts before sunrise or ends after sunset less the margin. */
export function runDarkness({
  date,
  lat,
  lon,
  now,
  durationS,
}: {
  /** 'YYYY-MM-DD' where the run is. */
  date: string
  lat: number
  lon: number
  now: number
  durationS: number
}): Darkness {
  const sun = sunTimes(date, lat, lon)
  if ('polar' in sun) return sun.polar === 'night' ? { kind: 'night' } : null
  if (now < sun.sunrise) return { kind: 'dawn', at: sun.sunrise }
  if (now + durationS * 1000 > sun.sunset - DUSK_MARGIN_MIN * MINUTE_MS) return { kind: 'dusk', at: sun.sunset }
  return null
}
