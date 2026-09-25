import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeatherChips } from '../WeatherChips'
import type { ActivityWeather } from '@/domain/activity/types'
import { t } from '@/i18n'

const weather = (over: Partial<ActivityWeather>) => ({ tempC: 22, code: 0, windKph: 12, windDirDeg: 0, ...over }) as ActivityWeather

describe('WeatherChips', () => {
  // G33: a missing wind printed "NaN km/h N".
  it('hides the wind chip when there is no wind reading', () => {
    const { container } = render(<WeatherChips weather={weather({ windKph: NaN })} />)
    expect(container.textContent).not.toContain('NaN')
    expect(screen.queryByLabelText(t.activity.weather.wind)).toBeNull()
  })

  it('shows the wind when it is there', () => {
    render(<WeatherChips weather={weather({})} />)
    expect(screen.getByLabelText(t.activity.weather.wind).textContent).toContain(`12 ${t.units.kmh}`)
  })
})
