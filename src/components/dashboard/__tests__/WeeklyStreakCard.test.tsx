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

  // H04: one target, the plan's km. Design review, Oct 2026: "6.1 / 52 km · 1 / 5 runs".
  it("reads the week against the plan's km, with its sessions", () => {
    render(<WeeklyStreakCard data={DATA} target={target()} today="2026-09-25" />)

    const s = t.dashboard.weeklyStreak
    const card = screen.getByTestId('week-card')
    expect(card.textContent).toContain(s.kmOf('6.1', '52'))
    expect(card.textContent).toContain(s.runsOf(1, 5))
    expect(card.textContent).not.toContain('23')
  })

  // Design review, Oct 2026: seven circles - planned dashed in the session's
  // category with its km, done in its type's colour (3.0.2), today the accent ring,
  // rest the hairline - and a letter under each.
  it('draws the week as seven circles with the km in them', () => {
    // After mount the card reads the reader's clock (useToday).
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 22, 12))
    const days: WeekTarget['days'] = [
      { date: '2026-09-21', ranKm: 8.5, runs: 1, plannedKm: 8, plannedSessions: 1, type: 'Base', state: 'done' },
      { date: '2026-09-22', ranKm: 0, runs: 0, plannedKm: 10, plannedSessions: 1, type: 'Threshold', state: 'planned' },
      { date: '2026-09-23', ranKm: 0, runs: 0, plannedKm: null, plannedSessions: 0, state: 'rest' },
      { date: '2026-09-24', ranKm: 0, runs: 0, plannedKm: 9.5, plannedSessions: 1, type: 'Base', state: 'planned' },
    ]
    render(<WeeklyStreakCard data={DATA} target={target({ days })} today="2026-09-22" sessionKinds={{ '2026-09-21': t.dashboard.weeklyStreak.kinds.easy, '2026-09-22': t.dashboard.weeklyStreak.kinds.threshold }} />)

    const strip = screen.getByTestId('week-strip')
    const circles = strip.querySelectorAll<HTMLElement>('[data-state]')
    // Done in the colour of what was run, as Plan draws it: an easy run's blue.
    expect(circles[0]!.style.border).toBe('2px solid var(--zone-2)')
    expect(circles[0]!.style.background).toContain('var(--zone-2)')
    expect(circles[0]!.textContent).toBe('8.5')
    expect(circles[1]!.style.border).toBe('2px solid var(--accent)')
    expect(circles[1]!.hasAttribute('data-today')).toBe(true)
    expect(circles[1]!.textContent).toBe('10')
    expect(circles[2]!.style.background).toBe('var(--surface-2)')
    expect(circles[2]!.textContent).toBe('–')
    expect(circles[3]!.style.border).toBe('1.5px dashed var(--zone-2)')
    expect(circles[3]!.textContent).toBe('9.5')
    expect(strip.textContent).not.toContain(t.units.km)
    // The session's name is the day's accessible name, not a word under it.
    expect(strip.querySelectorAll('li')[1]!.getAttribute('aria-label')).toContain(t.dashboard.weeklyStreak.kinds.threshold)
    expect(strip.textContent).not.toContain(t.dashboard.weeklyStreak.kinds.threshold)
  })

  it('falls back to the goal share when nothing is planned', () => {
    render(<WeeklyStreakCard data={DATA} target={target({ planKm: null, planSessions: 0 })} today="2026-09-25" />)

    expect(screen.getByTestId('week-card').textContent).toContain(t.dashboard.weeklyStreak.kmOf('6.1', '23'))
  })
})
