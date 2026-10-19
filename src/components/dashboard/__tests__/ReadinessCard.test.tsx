import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { formBand } from '@/domain/training/formBand'
import { t } from '@/i18n'
import { ReadinessCard, lastSevenDays, latestRatedStatus } from '../ReadinessCard'
import { dialFraction } from '../FormDial'

const STATUS = {
  status: 'productive', risk: 'low', loadTrend: 'building',
  tsbNow: -6, tsbDelta: 3, ctl: 54, ctlDelta: 2, ctlDeltaShown: 1, atl: 60, atlDelta: 4, acwr: 0.98,
} as unknown as TrainingStatus

const WEEK = { km: 9.8 }

function days(pattern: string): TrainingStatusDayBar[] {
  const key = { f: 'fresh', p: 'productive', m: 'maintaining', r: 'recovery' } as const
  return pattern.split('').map((c, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, status: key[c as keyof typeof key] }))
}

describe('latestRatedStatus', () => {
  it('reads the latest day the watch rated', () => {
    expect(latestRatedStatus(days('mmfrp'))).toBe('productive')
    expect(latestRatedStatus([...days('mmf'), { date: '2026-09-29', status: null }])).toBe('fresh')
    expect(latestRatedStatus([])).toBeNull()
  })
})

describe('the Form dial', () => {
  // -40 to +25 over a 240 degree arc: -6 sits just past the middle.
  it('marks today’s Form on the scale and names its band', () => {
    render(<ReadinessCard lastWeek={WEEK} status={STATUS} />)
    const dial = screen.getByTestId('form-dial')

    expect(dial.dataset.fraction).toBe(dialFraction(-6).toFixed(4))
    expect(dial.getAttribute('aria-label')).toBe(t.dashboard.readiness.formOnDial('−6', t.formBand[formBand(-6)]))
    expect(dial).toHaveTextContent('−6')
    expect(dial).toHaveTextContent(t.dashboard.readiness.formLabel)
  })

  it('rests the marker on the edge past the scale', () => {
    expect(dialFraction(40)).toBe(1)
    expect(dialFraction(-80)).toBe(0)
  })

  // The bands are the ones every screen names Form by.
  it('draws the tired, neutral and fresh bands in their own tokens', () => {
    const { container } = render(<ReadinessCard lastWeek={WEEK} status={STATUS} />)
    const arcs = [...container.querySelectorAll('svg path')].map((p) => p.getAttribute('stroke'))

    expect(arcs.slice(0, 3)).toEqual(['var(--warn)', 'var(--line-2)', 'var(--pos)'])
  })
})

describe('ReadinessCard', () => {
  it('reads the four numbers beside the dial, Garmin’s status among them', () => {
    render(<ReadinessCard lastWeek={WEEK} status={STATUS} watchStatus="productive" />)
    const card = screen.getByTestId('readiness-card')

    expect(card).toHaveTextContent(t.dashboard.readiness.ctl)
    expect(card).toHaveTextContent('54')
    expect(card).toHaveTextContent(t.dashboard.readiness.atl)
    expect(card).toHaveTextContent('60')
    expect(card).toHaveTextContent('0.98')
    expect(card).toHaveTextContent(t.trainingStatus.status.productive)
  })

  // Fitness climbing is good news, fatigue climbing is a caution.
  it('colours each delta by what it means', () => {
    render(<ReadinessCard lastWeek={WEEK} status={STATUS} />)
    const [fitness, fatigue] = screen.getAllByTestId('readiness-delta')

    expect(fitness!.textContent).toBe('+1')
    expect(fitness!.getAttribute('style')).toContain('var(--good)')
    expect(fatigue!.textContent).toBe('+4')
    expect(fatigue!.getAttribute('style')).toContain('var(--tone-caution)')
  })

  it('says the readiness word and its one line, and opens Analytics', () => {
    render(<ReadinessCard lastWeek={WEEK} status={STATUS} />)

    expect(screen.getByText(t.dashboard.readiness.eyebrowByTone.build).getAttribute('style')).toContain('var(--text-2)')
    expect(screen.getByText(t.dashboard.readiness.lineByTone.build)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.dashboard.readiness.open })).toHaveAttribute('href', '/analytics')
  })

  it('keeps both lines of the written verdict under a divider', () => {
    render(<ReadinessCard lastWeek={WEEK} status={STATUS} verdict={{ headline: 'Long run day.', body: 'Keep it conversational.' }} />)
    const verdict = screen.getByTestId('readiness-verdict')

    expect(verdict).toHaveTextContent('Long run day.')
    expect(verdict).toHaveTextContent('Keep it conversational.')
    expect(verdict.className).toContain('border-t')
  })

  // Without a written verdict there is no sentence: the rules-based prose is gone.
  it('shows no sentence without a written verdict', () => {
    render(<ReadinessCard lastWeek={WEEK} status={STATUS} />)
    expect(screen.queryByTestId('readiness-verdict')).toBeNull()
  })

  it('draws nothing without a training status', () => {
    const { container } = render(<ReadinessCard lastWeek={WEEK} status={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('writes a dash where ACWR has nothing', () => {
    render(<ReadinessCard lastWeek={WEEK} status={{ ...STATUS, acwr: null }} watchStatus="productive" />)
    expect(screen.getAllByText(t.dashboard.readiness.noValue)).toHaveLength(1)
  })
})

// A Forerunner 55 reports no training status: the last seven days take
// Garmin's place rather than a dash (owner, Oct 2026).
describe('without a Garmin training status', () => {
  it('shows the last seven days in its place', () => {
    render(<ReadinessCard lastWeek={WEEK} status={STATUS} />)
    const card = screen.getByTestId('readiness-card')

    expect(card).not.toHaveTextContent(t.dashboard.readiness.garmin)
    expect(card).toHaveTextContent(t.dashboard.readiness.lastSevenDays)
    expect(screen.getByTestId('readiness-last-week').textContent).toBe(`9.8${t.units.km}`)
    // On one line, like the other cells: no run count under the km.
    expect(card).not.toHaveTextContent(t.activities.weekLine.runs(3))
  })

  it('keeps Garmin’s status when the watch has one', () => {
    render(<ReadinessCard lastWeek={WEEK} status={STATUS} watchStatus="productive" />)
    expect(screen.queryByTestId('readiness-last-week')).toBeNull()
  })

  it('counts the last seven days, today included', () => {
    const runs = [
      { date: '2026-10-21', distanceKm: 3.8 },
      { date: '2026-10-19', distanceKm: 3 },
      { date: '2026-10-15', distanceKm: 3 },
      { date: '2026-10-14', distanceKm: 5 },
    ]
    expect(lastSevenDays(runs, '2026-10-21')).toEqual({ km: 9.8 })
  })
})
