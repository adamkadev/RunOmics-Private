import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { weekTarget, type WeekTargetDay } from '@/domain/training/weekTarget'
import { t } from '@/i18n'
import { ThisWeekCard, thisWeekBars } from '../ThisWeekCard'

const TODAY = '2026-10-20'
const day = (date: string, d: Partial<WeekTargetDay> = {}): WeekTargetDay => ({ date, ranKm: 0, runs: 0, plannedKm: null, plannedSessions: 0, ...d })

// Mon 19 run (8 of 10 planned), today 10 planned, Wed 11, Sun 13, the rest rest.
const DAYS: WeekTargetDay[] = [
  day('2026-10-19', { ranKm: 8, runs: 1, plannedKm: 10, plannedSessions: 1, type: 'Base' }),
  day('2026-10-20', { plannedKm: 10, plannedSessions: 1, type: 'Base' }),
  day('2026-10-21', { plannedKm: 11, plannedSessions: 1, type: 'Threshold' }),
  day('2026-10-22'),
  day('2026-10-23'),
  day('2026-10-24'),
  day('2026-10-25', { plannedKm: 13, plannedSessions: 1, type: 'Base' }),
]
const WEEK = weekTarget(DAYS, TODAY, null)

describe('ThisWeekCard (App Fixes 1a v2)', () => {
  it('scales km to the week\'s largest day, 62 px tall, never under 8', () => {
    const bars = thisWeekBars(WEEK, TODAY, {})
    expect(bars.map((b) => b.day.state)).toEqual(['done', 'planned', 'planned', 'rest', 'rest', 'rest', 'planned'])
    expect(bars[6]!.height).toBe(62)
    expect(bars[3]!.height).toBe(3)
    // A run day that had a plan carries its tick at the planned height.
    expect(bars[0]!.tick).toBe(Math.round((10 / 13) * 62))
    expect(bars[1]!.label).toBe('10')
  })

  it('dashes the days to come, tints today, and reads the load in the header', () => {
    render(<ThisWeekCard target={WEEK} today={TODAY} load={{ acute: 456, lo: 462, hi: 750, state: 'below', ratio: 0.79 }} />)

    const card = screen.getByTestId('this-week-card')
    expect(screen.getByTestId('this-week-link')).toHaveAttribute('href', '/plan?view=week')
    const bars = screen.getAllByTestId('week-bar')
    expect(bars[0]!.getAttribute('style')).not.toContain('dashed')
    expect(bars[2]!.getAttribute('style')).toContain('dashed')
    expect(screen.getAllByTestId('today-tint')).toHaveLength(1)
    expect(screen.getByTestId('plan-tick')).toBeInTheDocument()
    const reading = screen.getByTestId('load-reading')
    expect(reading.textContent).toBe(t.dashboard.thisWeek.load(456, 462, 750))
    expect(reading.style.color).toBe('var(--warn)')
    expect(card).toHaveTextContent(t.dashboard.thisWeek.runsLeft(3))
  })

  // Wave 5, Today › missed day.
  const MISSED = weekTarget([day('2026-10-19', { plannedKm: 8, plannedSessions: 1 }), ...DAYS.slice(1)], TODAY, null)

  it('dashes a missed day in amber, keeps its km, keys it and counts it', () => {
    render(<ThisWeekCard target={MISSED} today={TODAY} load={null} />)
    expect(screen.getAllByTestId('week-bar')[0]!.getAttribute('style')).toContain('var(--warn)')
    const link = screen.getByTestId('missed-bar-link')
    expect(link).toHaveAttribute('href', '/plan?date=2026-10-19')
    expect(link.textContent).toBe('8')
    expect(screen.getByTestId('legend-missed')).toBeInTheDocument()
    expect(screen.getByTestId('week-footer-count').textContent).toBe(`${t.dashboard.thisWeek.runsLeft(3)} · ${t.dashboard.thisWeek.missedCount(1)}`)
    expect(screen.queryByTestId('load-reading')).toBeNull()
  })

  it('draws a day skipped in Plan as a rest stub, and stops counting it', () => {
    localStorage.setItem('runomics-skipped-days', JSON.stringify(['2026-10-19']))
    render(<ThisWeekCard target={MISSED} today={TODAY} load={null} />)
    expect(screen.getAllByTestId('week-bar')[0]!.dataset.state).toBe('rest')
    expect(screen.queryByTestId('legend-missed')).toBeNull()
    expect(screen.queryByTestId('missed-bar-link')).toBeNull()
    localStorage.removeItem('runomics-skipped-days')
  })

  it('hides the missed key when nothing is missed', () => {
    render(<ThisWeekCard target={WEEK} today={TODAY} load={null} />)
    expect(screen.queryByTestId('legend-missed')).toBeNull()
  })
})
