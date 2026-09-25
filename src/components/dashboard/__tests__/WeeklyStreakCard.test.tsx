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
  // "6 of 23 km" here and "52 km" on Plan read as two answers to one question.
  it('names the ring as the weekly goal and gives the plan its own total', () => {
    render(<WeeklyStreakCard data={DATA} target={target()} today="2026-09-25" />)

    const s = t.dashboard.weeklyStreak
    const line = `${s.goalLabel} · ${s.planHas(5, '52')}`
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === line)).toBeInTheDocument()
    expect(screen.getByText(s.ringOf(23))).toBeInTheDocument()
  })

  it('leaves the plan out of the line when nothing is planned', () => {
    render(<WeeklyStreakCard data={DATA} target={target({ planKm: null, planSessions: 0 })} today="2026-09-25" />)

    expect(screen.getByText(t.dashboard.weeklyStreak.goalLabel)).toBeInTheDocument()
  })
})
