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
  it('bands the reading itself, not just the 12 px glyph', () => {
    render(<WeatherChips weather={weather(33)} />)

    const chip = screen.getByText('33°C')
    expect(chip.className).toContain('text-red-600')
    expect(chip.querySelector('svg')?.getAttribute('class') ?? '').not.toContain('text-red-600')
  })

  it('moves the band with the temperature', () => {
    render(<WeatherChips weather={weather(8)} />)
    expect(screen.getByText('8°C').className).toContain('text-cyan-600')
  })

  it('leaves the temperate range on the neutral accent ink', () => {
    render(<WeatherChips weather={weather(15)} />)
    expect(screen.getByText('15°C').className).toContain('text-accent-text')
  })

  it('keeps the wind chip out of the temperature ramp', () => {
    render(<WeatherChips weather={weather(33)} />)

    const wind = screen.getByLabelText('Wind')
    expect(wind.className).not.toContain('text-red-600')
  })
})
