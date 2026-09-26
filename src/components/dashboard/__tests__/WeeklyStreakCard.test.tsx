import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WeekTarget } from '@/domain/training/weekTarget'
import { t } from '@/i18n'
import { WeeklyStreakCard } from '../WeeklyStreakCard'

const DATA = { currentWeeks: 3, longestWeeks: 5, weekDays: Array(7).fill(false), plannedDays: Array(7).fill(false) }

function target(overrides: Partial<WeekTarget> = {}): WeekTarget {
  return { ranKm: 6.1, ranSessions: 1, planKm: 52, planSessions: 5, missedSessions: 0, goalKm: 23, days: [], ...overrides }
}

describe('WeeklyStreakCard', () => {
  // H04: one target, the plan's km. The ring measured a 23 km goal share
  // beside the plan's 52.
  it("reads the week against the plan's km, with its sessions", () => {
    render(<WeeklyStreakCard data={DATA} target={target()} today="2026-09-25" />)

    const s = t.dashboard.weeklyStreak
    const card = screen.getByTestId('week-card')
    expect(card.textContent).toContain(s.ofKm('52'))
    expect(card.textContent).toContain(s.sessionsOf(1, 5))
    expect(card.textContent).not.toContain('23')
    expect(card.querySelector('svg circle')).toBeNull()
  })

  it('falls back to the goal share when nothing is planned', () => {
    render(<WeeklyStreakCard data={DATA} target={target({ planKm: null, planSessions: 0 })} today="2026-09-25" />)

    expect(screen.getByTestId('week-card').textContent).toContain(t.dashboard.weeklyStreak.ofKm('23'))
  })
})
