import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Sun,
  Wind,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ActivityWeather } from '@/domain/activity/types'
import { compassPoint, weatherCondition, type WeatherCondition } from '@/domain/activity/weather'
import { temperatureIconColor } from '@/lib/colors'
import { t } from '@/i18n'

const CONDITION_ICONS: Record<WeatherCondition, LucideIcon> = {
  clear: Sun,
  mainlyClear: CloudSun,
  partlyCloudy: CloudSun,
  overcast: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  freezingDrizzle: CloudDrizzle,
  rain: CloudRain,
  freezingRain: CloudRain,
  snow: CloudSnow,
  showers: CloudRainWind,
  snowShowers: CloudSnow,
  thunderstorm: CloudLightning,
}

const CHIP_CLASS = 'glass-map-chip flex items-center gap-1 whitespace-nowrap px-2.5 py-1.5 text-xs font-semibold'

export function WeatherChips({ weather }: { weather: ActivityWeather }) {
  const w = t.activity.weather
  const condition = weatherCondition(weather.code)
  const Icon = condition ? CONDITION_ICONS[condition] : Cloud
  const temperature = `${Math.round(weather.tempC)}${t.units.celsius}`

  return (
    <>
      <div
        className={CHIP_CLASS}
        aria-label={condition ? `${w.conditions[condition]}, ${temperature}` : undefined}
      >
        <Icon size={12} className={temperatureIconColor(weather.tempC)} />
        {temperature}
      </div>
      <div className={CHIP_CLASS} aria-label={w.wind}>
        <Wind size={12} className="text-subtle" />
        {Math.round(weather.windKph)} {t.units.kmh} {w.compass[compassPoint(weather.windDirDeg)]}
      </div>
    </>
  )
}
