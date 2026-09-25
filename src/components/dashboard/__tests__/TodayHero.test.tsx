import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ActivitySummary } from '@/domain/activity/types'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { t } from '@/i18n'
import { TodayHero } from '../TodayHero'

const RUN: ActivitySummary = {
  id: 'a1', date: '2026-09-24', dayOfWeek: 'Thursday', type: 'Threshold', description: 'Threshold', comment: '',
  distanceKm: 6.11, durationSeconds: 1_528, paceSecPerKm: 250, avgHeartRate: 160, rpe: null, hrZones: [], week: 0, elevationGain: null,
}
const PLAN = { title: 'Threshold', type: 'Threshold' as const, duration: { seconds: 1_500, estimated: false }, distanceM: 6_000, activityId: 'a1', target: null }

describe('TodayHero', () => {
  it('draws on the card surface and tokens, not fixed hexes', () => {
    const { container } = render(<TodayHero status={null} plannedWorkout={PLAN} todayActivity={null} aiVerdict={null} />)
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
        plannedWorkout={PLAN}
        todayActivity={RUN}
        aiVerdict={{ headline: 'Steady day.', body: 'Keep it moderate.' }}
      />,
    )

    const row = screen.getByTestId('session-card')
    expect(row).toHaveTextContent(`✓ ${t.sessionState.done}`)
    expect(row).toHaveTextContent('Threshold · 25 min Z4')
    expect(row).toHaveTextContent(`${t.sessionCard.ranAt('6.11', '4:10 /km')} · ${t.sessionCard.plannedKm('6')}`)
    expect(row.getAttribute('href')).toBe('/activities/a1')
    expect(screen.getByText(t.sessionCard.coachInsight)).toBeInTheDocument()
  })

  it('keeps the offline copy when the AI insight is missing', () => {
    const status = { tsbNow: 2, tsbDelta: 1, ctl: 40, atl: 38, loadTrend: 'maintaining' } as unknown as TrainingStatus
    render(<TodayHero status={status} plannedWorkout={null} todayActivity={null} aiVerdict={null} />)

    expect(screen.queryByText(t.sessionCard.coachInsight)).not.toBeInTheDocument()
    expect(screen.getByTestId('session-card')).toHaveTextContent(t.dashboard.todayHero.restDay)
  })

  // The race is the plan's reason, not a daily number: its countdown stays on
  // Plan and Goals.
  it('carries no race countdown', () => {
    const { container } = render(<TodayHero status={null} plannedWorkout={PLAN} todayActivity={null} aiVerdict={null} />)

    expect(container.textContent).not.toMatch(/D-\d+/)
  })
})
