import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCountdown } from '@/lib/formatters'
import { hydrateAcrossMidnight } from '@/lib/__tests__/hydrateAcrossMidnight'
import { TodayHero } from '../TodayHero'
import type { ActivitySummary } from '@/domain/activity/types'
import { t } from '@/i18n'

const RUN: ActivitySummary = {
  id: 'a1', date: '2026-09-24', dayOfWeek: 'Thursday', type: 'Threshold', description: 'Threshold', comment: '',
  distanceKm: 6.11, durationSeconds: 1_528, paceSecPerKm: 250, avgHeartRate: 160, rpe: null, hrZones: [], week: 0, elevationGain: null,
}

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

  // The card used to be a fixed navy in both themes; it is the card surface
  // now, so the countdown takes the theme's ink.
  it('inks the race countdown from the theme', () => {
    render(hero('2026-09-24'))

    const chip = screen.getByText(formatCountdown(10))
    expect(chip.className).toContain('text-muted-foreground')
    expect(chip.className).not.toContain('text-white')
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

  it('draws on the card surface and tokens, not fixed hexes', () => {
    const { container } = render(hero('2026-09-24'))
    const card = container.firstElementChild as HTMLElement

    expect(card.className).toContain('glass-card')
    expect(card.getAttribute('style')).not.toMatch(/#101a2c|rgba\(148,\s*178,\s*220/)
    expect(card.style.borderLeftColor).toBe('var(--tone-caution)')
  })

  // The footer showed a finished run's "6.11 km · 25 min" with no state, so it
  // read like the session still to do.
  it('leads the session row with its state and planned against ran', () => {
    render(
      <TodayHero
        status={null}
        plannedWorkout={{ title: 'Threshold', type: 'Threshold', duration: { seconds: 1_500, estimated: false }, distanceM: 6_000, activityId: 'a1', target: null }}
        todayActivity={RUN}
        nextRace={null}
        aiVerdict={{ headline: 'Steady day.', body: 'Keep it moderate.' }}
        today="2026-09-24"
      />,
    )

    const row = screen.getByTestId('session-card')
    expect(row).toHaveTextContent(`✓ ${t.sessionState.done}`)
    expect(row).toHaveTextContent('Threshold · 25 min Z4')
    expect(row).toHaveTextContent(`${t.sessionCard.ranAt('6.11', '4:10 /km')} · ${t.sessionCard.plannedKm('6')}`)
    expect(row.getAttribute('href')).toBe('/activities/a1')
    expect(screen.getByText(t.sessionCard.coachInsight)).toBeInTheDocument()
  })
})

