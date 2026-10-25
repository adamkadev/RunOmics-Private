import { describe, expect, it } from 'vitest'
import type { ActivityWeather } from '@/domain/activity/types'
import { conditionsChips, garminActivityUrl } from '../runConditions'

const weather = (over: Partial<ActivityWeather> = {}): ActivityWeather => ({
  tempC: 18.2, apparentTempC: 18, humidityPct: 60, windKph: 2.4, windDirDeg: 0, precipitationMm: 0, code: 0, ...over,
})

describe('conditionsChips', () => {
  it('reads the sky, the temperature, then the wind', () => {
    expect(conditionsChips(weather())).toEqual(['Clear sky · 18°C', 'wind 2 km/h N'])
    expect(conditionsChips(weather({ code: 61 }))).toEqual(['Rain · 18°C', 'wind 2 km/h N'])
  })

  it('adds feels-like 3° apart, and the humidity once the dew point is muggy', () => {
    expect(conditionsChips(weather({ apparentTempC: 14.9, code: 3 }))).toEqual(['Overcast · 18°C, feels 15°C', 'wind 2 km/h N'])
    expect(conditionsChips(weather({ tempC: 24, apparentTempC: 27, humidityPct: 70 }))).toEqual(['Clear sky · 24°C, feels 27°C', '70% humidity · wind 2 km/h N'])
    expect(conditionsChips(weather({ tempC: 24, apparentTempC: 24, humidityPct: 50 }))).toEqual(['Clear sky · 24°C', 'wind 2 km/h N'])
  })

  it('drops what it has no reading for', () => {
    expect(conditionsChips(weather({ windKph: NaN, code: NaN }))).toEqual(['18°C'])
    expect(conditionsChips(weather({ windDirDeg: NaN, code: 42 }))).toEqual(['18°C', 'wind 2 km/h'])
  })
})

describe('garminActivityUrl', () => {
  it('points at the run in Garmin Connect, where its shoe is set', () => {
    expect(garminActivityUrl('24484856246')).toBe('https://connect.garmin.com/modern/activity/24484856246')
  })
})
