import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCountdown } from '@/lib/formatters'
import { hydrateAcrossMidnight } from '@/lib/__tests__/hydrateAcrossMidnight'
import { TodayHero } from '../TodayHero'

const NOW = new Date(2026, 8, 24, 9)
const RACE = { date: '2026-10-04', name: 'City 10K', distance: '10K' }

function hero(today: string) {
  return <TodayHero status={null} plannedWorkout={null} todayActivity={null} nextRace={RACE} aiVerdict={null} today={today} />
}

describe('TodayHero', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  // The card is dark in both themes. Its countdown chip read the theme's
  // muted-foreground, which is a dark ink on a light system theme: 1.9:1.
  it('inks the race countdown for its own dark surface, not the theme', () => {
    render(hero('2026-09-24'))

    const chip = screen.getByText(formatCountdown(10))
    expect(chip.style.color).toBe('')
    expect(chip.className).toContain('text-white/70')
  })

  // Built at 23:50 and opened at 00:10, the countdown used to be computed
  // twice from two clocks - 11 days on the server, 10 in the browser - and
  // hydration failed on the difference.
  it('hydrates the countdown the page was built with, then counts from today', async () => {
    const { html, container, recoverableErrors } = await hydrateAcrossMidnight(hero('2026-09-23'), {
      serverTime: new Date(2026, 8, 23, 23, 50),
      clientTime: new Date(2026, 8, 24, 0, 10),
    })

    expect(html).toContain(formatCountdown(11))
    expect(recoverableErrors).toEqual([])
    expect(container.textContent).toContain(formatCountdown(10))
  })
})
