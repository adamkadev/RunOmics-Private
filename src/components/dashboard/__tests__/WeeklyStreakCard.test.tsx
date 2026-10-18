import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WeekTarget } from '@/domain/training/weekTarget'
import { t } from '@/i18n'
import { WeeklyStreakCard } from '../WeeklyStreakCard'

const DATA = { currentWeeks: 3, longestWeeks: 5, weekDays: Array(7).fill(false), plannedDays: Array(7).fill(false) }

function target(overrides: Partial<WeekTarget> = {}): WeekTarget {
  return { ranKm: 6.1, ranSessions: 1, planKm: 52, planSessions: 5, plannedDone: 1, unplannedRuns: 0, missedSessions: 0, goalKm: 23, days: [], ...overrides }
}

describe('WeeklyStreakCard', () => {
  afterEach(() => vi.useRealTimers())

  // H04: one target, the plan's km. The ring measured a 23 km goal share
  // beside the plan's 52.
  it("reads the week against the plan's km, with its sessions", () => {
    render(<WeeklyStreakCard data={DATA} target={target()} today="2026-09-25" />)

    const s = t.dashboard.weeklyStreak
    const card = screen.getByTestId('week-card')
    expect(card.textContent).toContain(s.ofKm('52'))
    expect(card.textContent).toContain(s.runsOf(1, 5))
    expect(card.textContent).not.toContain('23')
    expect(card.querySelector('svg circle')).toBeNull()
    // v4.17: the empty progress track under the total is gone.
    expect(screen.queryByTestId('week-progress')).toBeNull()
  })

  // v4.17: planned km as dashed bars in the session's category, the run in
  // the accent, today in the accent outline, each day named by its session.
  it('draws the week as bars of its km, named by their sessions', () => {
    // After mount the card reads the reader's clock (useToday).
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 22, 12))
    const days: WeekTarget['days'] = [
      { date: '2026-09-21', ranKm: 8.5, runs: 1, plannedKm: 8, plannedSessions: 1, type: 'Base', state: 'done' },
      { date: '2026-09-22', ranKm: 0, runs: 0, plannedKm: 10, plannedSessions: 1, type: 'Threshold', state: 'planned' },
      { date: '2026-09-23', ranKm: 0, runs: 0, plannedKm: null, plannedSessions: 0, state: 'rest' },
    ]
    render(<WeeklyStreakCard data={DATA} target={target({ days })} today="2026-09-22" sessionKinds={{ '2026-09-21': t.dashboard.weeklyStreak.kinds.easy, '2026-09-22': t.dashboard.weeklyStreak.kinds.threshold }} />)

    const strip = screen.getByTestId('week-strip')
    const bars = strip.querySelectorAll<HTMLElement>('[data-state]')
    expect(bars[0]!.style.background).toBe('var(--accent)')
    expect(bars[1]!.style.border).toBe('2px solid var(--accent)')
    expect(bars[1]!.hasAttribute('data-today')).toBe(true)
    expect(bars[2]!.style.height).toBe('8px')
    expect(strip.textContent).toContain('8.5')
    expect(strip.textContent).toContain('10')
    expect(strip.textContent).not.toContain(`8.5 ${t.units.km}`)
    expect(strip.textContent).toContain('Easy')
    expect(strip.textContent).toContain(t.sessionState.rest)
    // v4.17.3: the short word under 480 pt, the full name above it, never an ellipsis.
    const tue = screen.getAllByTestId('week-strip-kind')[1]!
    const [short, long] = [...tue.children] as HTMLElement[]
    expect(short!.textContent).toBe(t.dashboard.weeklyStreak.kinds.threshold.shortLabel)
    expect(short!.className).toContain('min-[480px]:hidden')
    expect(long!.textContent).toBe(t.dashboard.weeklyStreak.kinds.threshold.label)
    expect(long!.className).toContain('hidden min-[480px]:inline')
    expect(tue.className).not.toMatch(/truncate|ellipsis|nowrap/)
  })

  it('falls back to the goal share when nothing is planned', () => {
    render(<WeeklyStreakCard data={DATA} target={target({ planKm: null, planSessions: 0 })} today="2026-09-25" />)

    expect(screen.getByTestId('week-card').textContent).toContain(t.dashboard.weeklyStreak.ofKm('23'))
  })
})
