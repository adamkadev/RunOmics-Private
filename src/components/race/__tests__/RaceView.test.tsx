import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RacePageData } from '@/application/usecases/GetRacePage'
import type { FormForecast } from '@/domain/training/formForecast'
import { t } from '@/i18n'
import { RaceView } from '../RaceView'

const data = (form: FormForecast): RacePageData => ({
  race: { date: '2026-11-15', name: 'Winter 10K', distance: '10K' },
  distance: '10k',
  distanceKm: 10,
  daysUntil: 19,
  predictedSeconds: null,
  targetSeconds: null,
  pb: null,
  trend: [],
  estimate: null,
  form,
})

describe('RaceView race-day form', () => {
  it('prints the forecast form with its band, fitness and fatigue', () => {
    render(<RaceView data={data({
      kind: 'forecast',
      raceDay: { ctl: 52.4, atl: 40.1, tsb: 12.3 },
      tsbToday: -8,
      points: [{ date: '2026-10-27', tsb: -8, planned: false }, { date: '2026-11-15', tsb: 12.3, planned: true }],
    })} />)

    expect(screen.getByTestId('race-form-tsb')).toHaveTextContent('+12')
    expect(screen.getByTestId('race-form')).toHaveTextContent(t.formBand.fresh)
    expect(screen.getByTestId('race-form')).toHaveTextContent(`${t.dashboard.readiness.ctl}52`)
    expect(screen.getByTestId('race-form-line')).toBeInTheDocument()
  })

  it('says why there is no number instead of making one up', () => {
    render(<RaceView data={data({ kind: 'shortHistory', runningDays: 20, neededDays: 42 })} />)

    expect(screen.getByTestId('race-form-unavailable')).toHaveTextContent(t.race.formShortHistory(20, 42))
    expect(screen.queryByTestId('race-form-tsb')).toBeNull()
  })

  it('waits for a plan that reaches the race week', () => {
    render(<RaceView data={data({ kind: 'planShort', plannedThrough: null })} />)

    expect(screen.getByTestId('race-form-unavailable')).toHaveTextContent(t.race.formNoPlan)
  })
})
