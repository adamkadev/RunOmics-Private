import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCoachingOverview, type CoachingOverview } from '@/application/coaching/GetCoachingView'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { formatDateRange } from '@/lib/formatters'
import { hydrateAcrossMidnight } from '@/lib/__tests__/hydrateAcrossMidnight'
import { PlanClient } from '../PlanClient'

const NOW = new Date(2026, 8, 9, 12)

function planClient(coaching: CoachingOverview | null = null, today = '2026-09-09') {
  return (
    <PlanClient
      activities={[]}
      plannedWorkouts={[]}
      planPhaseRanges={[]}
      nextRace={null}
      trainingZones={null}
      planSpan={null}
      coaching={coaching}
      today={today}
    />
  )
}

function renderPlan(coaching: CoachingOverview | null = null) {
  return render(planClient(coaching))
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
    expect(screen.queryByTestId('week-summary')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.week }))
    expect(screen.getByTestId('week-summary')).toBeInTheDocument()
  })

  it('behaves the same way once a coaching block is active', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPlan(buildCoachingOverview(plan(), [], [], [], [], '2026-09-09'))

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.month }))
    expect(screen.getByRole('tab', { name: t.plan.switcher.month }).getAttribute('aria-selected')).toBe('true')

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.week }))
    expect(screen.getByTestId('week-summary')).toBeInTheDocument()
  })

  it('adds no coaching chrome to the header when no plan is active', () => {
    const { container } = renderPlan()

    expect(container.textContent).not.toMatch(/Garmin out of date/i)
    expect(screen.queryByTestId('race-footer')).not.toBeInTheDocument()
  })
})

describe('PlanClient across midnight', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  // Built on Tuesday night, opened on Wednesday: the week is the same, but the
  // selected day and its label were read from two different clocks.
  it('hydrates the page it was built as', async () => {
    const { recoverableErrors } = await hydrateAcrossMidnight(planClient(null, '2026-09-08'), {
      serverTime: new Date(2026, 8, 8, 23, 50),
      clientTime: new Date(2026, 8, 9, 0, 10),
    })

    expect(recoverableErrors).toEqual([])
  })

  it('moves on to the new week when the page was built on the last day of the old one', async () => {
    const { container, recoverableErrors } = await hydrateAcrossMidnight(planClient(null, '2026-09-13'), {
      serverTime: new Date(2026, 8, 13, 23, 50),
      clientTime: new Date(2026, 8, 14, 0, 10),
    })

    expect(recoverableErrors).toEqual([])
    expect(container.textContent).toContain(formatDateRange('2026-09-14', '2026-09-20'))
    expect(within(container).queryByRole('button', { name: t.plan.today })).not.toBeInTheDocument()
  })
})

