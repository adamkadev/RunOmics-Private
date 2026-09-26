import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ActivityWeather } from '@/domain/activity/types'
import { WeatherChips } from '../WeatherChips'

function weather(tempC: number): ActivityWeather {
  return {
    tempC,
    apparentTempC: tempC,
    humidityPct: 55,
    windKph: 11,
    windDirDeg: 225,
    precipitationMm: 0,
    code: 0,
  }
}

describe('WeatherChips', () => {
  // v4.3.1: the reading is text ink at every temperature; amber is caution's.
  it('prints the temperature in text ink, whatever the reading', () => {
    for (const celsius of [0, 8, 15, 26, 33]) {
      const { unmount } = render(<WeatherChips weather={weather(celsius)} />)
      const chip = screen.getByText(`${celsius}°C`)
      expect(chip.className).toContain('text-foreground')
      expect(chip.className).not.toMatch(/text-(red|cyan|emerald|amber|orange|blue)-/)
      unmount()
    }
  })

  it('lets the wind chip give way under 390 pt', () => {
    render(<WeatherChips weather={weather(15)} />)
    expect(screen.getByTestId('map-wind-chip').className).toContain('max-[389px]:hidden')
  })

  it('keeps the wind chip out of the temperature ramp', () => {
    render(<WeatherChips weather={weather(33)} />)

    const wind = screen.getByLabelText('Wind')
    expect(wind.className).not.toContain('text-red-600')
  })
})
