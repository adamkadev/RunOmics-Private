import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCountdown } from '@/lib/formatters'
import { TodayHero } from '../TodayHero'

const NOW = new Date(2026, 8, 24, 9)
const RACE = { date: '2026-10-04', name: 'City 10K', distance: '10K' }

describe('TodayHero', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  // The card is dark in both themes. Its countdown chip read the theme's
  // muted-foreground, which is a dark ink on a light system theme: 1.9:1.
  it('inks the race countdown for its own dark surface, not the theme', () => {
    render(<TodayHero status={null} plannedWorkout={null} todayActivity={null} nextRace={RACE} aiVerdict={null} />)

    const chip = screen.getByText(formatCountdown(10))
    expect(chip.style.color).toBe('')
    expect(chip.className).toContain('text-white/70')
  })
})
