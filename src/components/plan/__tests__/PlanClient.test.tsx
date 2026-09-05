import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCoachingOverview, type CoachingOverview } from '@/application/coaching/GetCoachingView'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { PlanClient } from '../PlanClient'

// Pinned inside the fixture block's first week so both views have data to show.
const NOW = new Date(2026, 8, 9, 12)

function renderPlan(coaching: CoachingOverview | null = null) {
  return render(
    <PlanClient
      activities={[]}
      plannedWorkouts={[]}
      statusByDate={{}}
      planPhaseRanges={[]}
      nextRace={null}
      trainingZones={null}
      planSpan={null}
      coaching={coaching}
    />
  )
}

describe('PlanClient week/month switching', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('opens on the week view', () => {
    renderPlan()

    expect(screen.getByRole('tab', { name: t.plan.switcher.week }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: t.plan.switcher.month }).getAttribute('aria-selected')).toBe('false')
  })

  it('switches to the month view and back', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPlan()

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.month }))
    expect(screen.getByRole('tab', { name: t.plan.switcher.month }).getAttribute('aria-selected')).toBe('true')
    // The week-only stat tiles go away with it.
    expect(screen.queryByText(t.plan.weekSummary.easyHard)).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.week }))
    expect(screen.getByText(t.plan.weekSummary.easyHard)).toBeInTheDocument()
  })

  it('behaves the same way once a coaching block is active', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPlan(buildCoachingOverview(plan(), [], [], [], [], '2026-09-09'))

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.month }))
    expect(screen.getByRole('tab', { name: t.plan.switcher.month }).getAttribute('aria-selected')).toBe('true')

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.week }))
    expect(screen.getByText(t.plan.weekSummary.easyHard)).toBeInTheDocument()
  })

  it('adds no coaching chrome to the header when no plan is active', () => {
    const { container } = renderPlan()

    expect(container.textContent).not.toMatch(/Garmin out of date/i)
    expect(screen.queryByTestId('coach-prescription-detail')).not.toBeInTheDocument()
    expect(screen.queryByTestId('race-footer')).not.toBeInTheDocument()
  })
})
