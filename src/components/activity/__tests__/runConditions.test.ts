import { describe, expect, it } from 'vitest'
import type { ActivityWeather } from '@/domain/activity/types'
import { conditionsText, garminActivityUrl } from '../runConditions'

const weather = (over: Partial<ActivityWeather> = {}): ActivityWeather => ({
  tempC: 18.2, apparentTempC: 18, humidityPct: 60, windKph: 2.4, windDirDeg: 0, precipitationMm: 0, code: 0, ...over,
})

describe('conditionsText', () => {
  it('reads like the mock: temperature, then the wind', () => {
    expect(conditionsText(weather())).toBe('18°C · wind 2 km/h N')
  })

  it('drops the wind without a reading, and its direction without one', () => {
    expect(conditionsText(weather({ windKph: NaN }))).toBe('18°C')
    expect(conditionsText(weather({ windDirDeg: NaN }))).toBe('18°C · wind 2 km/h')
  })
})

describe('garminActivityUrl', () => {
  it('points at the run in Garmin Connect, where its shoe is set', () => {
    expect(garminActivityUrl('24484856246')).toBe('https://connect.garmin.com/modern/activity/24484856246')
  })
})
