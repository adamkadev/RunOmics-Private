import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCoachingOverview, type CoachingOverview } from '@/application/coaching/GetCoachingView'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { formatDateRange } from '@/lib/formatters'
import { hydrateAcrossMidnight } from '@/lib/__tests__/hydrateAcrossMidnight'
import { PlanClient } from '../PlanClient'
import { planCoachingView, type PlanCoachingView } from '../planCoachingView'

const NOW = new Date(2026, 8, 9, 12)

function planClient(coaching: CoachingOverview | PlanCoachingView | null = null, today = '2026-09-09') {
  return (
    <PlanClient
      activities={[]}
      plannedWorkouts={[]}
      planPhaseRanges={[]}
      nextRace={null}
      trainingZones={null}
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

  // Design review, Oct 2026: the phase and its week under the title, then
  // the race and its countdown, in both views.
  it('names the phase, the week and the race under the title', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(planClient(planCoachingView(buildCoachingOverview(plan(), [], [], [], [], '2026-09-09'))))

    const w = t.plan.weekPurpose
    const subtitle = `${w.planPhase.base} · ${w.weekOfTarget(1, 6)} · ${t.plan.header.raceIn('10K', 39)}`
    expect(screen.getByTestId('plan-subtitle').textContent).toBe(subtitle)
    // The phase in ink, the rest muted.
    expect(screen.getByText(w.planPhase.base).className).toContain('font-semibold')
    await user.click(screen.getByRole('tab', { name: t.plan.switcher.month }))
    expect(screen.getByTestId('plan-subtitle').textContent).toBe(subtitle)
  })

  it('follows the week paged to', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(planClient(planCoachingView(buildCoachingOverview(plan(), [], [], [], [], '2026-09-09'))))

    await user.click(screen.getByRole('button', { name: t.plan.nextPeriod }))
    expect(screen.getByTestId('plan-subtitle').textContent).toContain(t.plan.weekPurpose.weekOfTarget(2, 6))
  })

  it('has no subtitle without a plan or a race', () => {
    renderPlan()

    expect(screen.queryByTestId('plan-subtitle')).toBeNull()
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

// Today's next workout opens Plan on its day (design review, Oct 2026).
describe('PlanClient on a linked day', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('opens the week view on ?date=, with that day selected', () => {
    window.history.replaceState(null, '', '/plan?date=2026-09-17')
    const { container } = renderPlan()

    expect(screen.getByRole('tab', { name: t.plan.switcher.week }).getAttribute('aria-selected')).toBe('true')
    expect(container.textContent).toContain(formatDateRange('2026-09-14', '2026-09-20'))
    // Thursday, the fourth day of the week, is the one selected.
    const days = [...container.querySelectorAll('button[aria-pressed]')]
    expect(days.map((day) => day.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true', 'false', 'false', 'false'])
  })

  it('ignores a date it cannot read', () => {
    window.history.replaceState(null, '', '/plan?date=tomorrow')
    const { container } = renderPlan()

    expect(container.textContent).toContain(formatDateRange('2026-09-07', '2026-09-13'))
  })
})
