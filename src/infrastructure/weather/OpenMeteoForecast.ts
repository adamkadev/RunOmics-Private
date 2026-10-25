import type { HourlyForecast } from '@/domain/activity/heatAhead'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/** Today renders on the server: a slow answer must cost the page a line, not seconds. */
const TIMEOUT_MS = 2_500

/** The page's own ISR window, so a render inside it reuses the answer. */
const REVALIDATE_S = 3_600

/** `lat`/`lon` are already coarse; the URL is never logged, as it still says roughly where the athlete lives. */
export async function fetchHourlyForecast(lat: number, lon: number, date: string, timeZone: string): Promise<HourlyForecast[] | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m,apparent_temperature',
    timezone: timeZone,
    start_date: date,
    end_date: date,
  })
  try {
    const response = await fetch(`${FORECAST_URL}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_S },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { hourly?: { time?: unknown; temperature_2m?: unknown; apparent_temperature?: unknown } }
    const { time, temperature_2m: temp, apparent_temperature: apparent } = body.hourly ?? {}
    if (!Array.isArray(time) || !Array.isArray(temp) || !Array.isArray(apparent)) return null
    return time.flatMap((at, i) => {
      const tempC = temp[i]
      const apparentTempC = apparent[i]
      return typeof at === 'string' && typeof tempC === 'number' && typeof apparentTempC === 'number' ? [{ time: at, tempC, apparentTempC }] : []
    })
  } catch {
    return null
  }
}
