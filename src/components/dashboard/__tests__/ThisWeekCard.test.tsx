import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { weekTarget, type WeekTargetDay } from '@/domain/training/weekTarget'
import { t } from '@/i18n'
import type { SkipReason } from '@/domain/wellness/checkIn'
import { ThisWeekCard, thisWeekBars } from '../ThisWeekCard'

const skipped = new Map<string, SkipReason>()
vi.mock('@/lib/skippedDays', () => ({ useSkippedDays: () => skipped }))

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
  // The card reads the reader's clock once mounted (useToday): pinned to the fixture's today, or the test fails on any other day.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 20, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('scales km to the week\'s largest day, 66 px tall, and draws nothing on a day without a run', () => {
    const bars = thisWeekBars(WEEK, TODAY, {})
    expect(bars.map((b) => b.day.state)).toEqual(['done', 'planned', 'planned', 'rest', 'rest', 'rest', 'planned'])
    expect(bars[6]!.height).toBe(66)
    expect(bars[3]!.height).toBe(0)
    expect(bars[0]!.label).toBe('8')
    expect(bars[1]!.label).toBe('10')
  })

  it('dashes the days to come, tints today, and leaves the load to the readiness card', () => {
    render(<ThisWeekCard target={WEEK} today={TODAY} />)

    const card = screen.getByTestId('this-week-card')
    expect(screen.getByTestId('this-week-link')).toHaveAttribute('href', '/plan?view=week')
    const bars = screen.getAllByTestId('week-bar')
    expect(bars[0]!.getAttribute('style')).not.toContain('dashed')
    expect(bars[2]!.getAttribute('style')).toContain('dashed')
    expect(screen.getAllByTestId('today-tint')).toHaveLength(1)
    expect(card.querySelectorAll('.state-today')).toHaveLength(1)
    expect(card.querySelector('.state-today')!.textContent).toBe('T')
    expect(screen.queryByTestId('plan-tick')).toBeNull()
    // One swatch per session colour in the week, easiest first, in the bars' colours.
    expect(screen.getAllByTestId('legend-type').map((e) => e.textContent)).toEqual([
      t.dashboard.weeklyStreak.kinds.easy,
      t.dashboard.weeklyStreak.kinds.threshold,
    ])
    expect(card.textContent).not.toContain('462')
    expect(card).toHaveTextContent(t.dashboard.thisWeek.runsLeft(3))
  })

  const MISSED = weekTarget([day('2026-10-19', { plannedKm: 8, plannedSessions: 1 }), ...DAYS.slice(1)], TODAY, null)

  it('dashes a missed day in amber, keeps its km, keys it and counts it', () => {
    render(<ThisWeekCard target={MISSED} today={TODAY} />)
    expect(screen.getAllByTestId('week-bar')[0]!.getAttribute('style')).toContain('var(--warn)')
    const link = screen.getByTestId('missed-bar-link')
    expect(link).toHaveAttribute('href', '/plan?date=2026-10-19')
    expect(link.textContent).toBe('8')
    expect(screen.getByTestId('legend-missed')).toBeInTheDocument()
    expect(screen.getByTestId('week-footer-count').textContent).toBe(`${t.dashboard.thisWeek.runsLeft(3)} · ${t.dashboard.thisWeek.missedCount(1)}`)
  })

  it('draws a day skipped in Plan as a rest stub, and stops counting it', () => {
    skipped.set('2026-10-19', 'ill')
    render(<ThisWeekCard target={MISSED} today={TODAY} />)
    expect(screen.getAllByTestId('week-bar')[0]!.dataset.state).toBe('rest')
    expect(screen.queryByTestId('legend-missed')).toBeNull()
    expect(screen.queryByTestId('missed-bar-link')).toBeNull()
    skipped.clear()
  })

  it('draws a session run the next day as done, its km on the day it was run', () => {
    const moved = weekTarget([
      day('2026-10-19', { plannedKm: 10, plannedSessions: 1, type: 'Base' }),
      day('2026-10-20', { ranKm: 9.5, runs: 1, type: 'Base' }),
    ], TODAY, null)
    const bars = thisWeekBars(moved, TODAY, {})
    expect(bars.map((b) => [b.day.state, b.label])).toEqual([['done', null], ['done', '9.5']])
  })

  it('hides the missed key when nothing is missed', () => {
    render(<ThisWeekCard target={WEEK} today={TODAY} />)
    expect(screen.queryByTestId('legend-missed')).toBeNull()
  })
})
