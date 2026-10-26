import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCoachingOverview, type CoachingOverview } from '@/application/coaching/GetCoachingView'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { formatDate, formatDateRange } from '@/lib/formatters'
import { hydrateAcrossMidnight } from '@/lib/__tests__/hydrateAcrossMidnight'
import { PlanClient, planDateParam } from '../PlanClient'
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
      hrZoneBoundsBpm={null}
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
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('opens on the week view', () => {
    renderPlan()

    expect(screen.getByRole('tab', { name: t.plan.switcher.week }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: t.plan.switcher.month }).getAttribute('aria-selected')).toBe('false')
  })

  it('switches to the month view and back, keeping the view in the URL', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPlan()

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.month }))
    expect(screen.getByRole('tab', { name: t.plan.switcher.month }).getAttribute('aria-selected')).toBe('true')
    expect(window.location.search).toBe('?view=month')
    expect(screen.queryByTestId('day-selector')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.week }))
    expect(screen.getByTestId('day-selector')).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('behaves the same way once a coaching block is active', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPlan(buildCoachingOverview(plan(), [], [], '2026-09-09'))

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.month }))
    expect(screen.getByRole('tab', { name: t.plan.switcher.month }).getAttribute('aria-selected')).toBe('true')

    await user.click(screen.getByRole('tab', { name: t.plan.switcher.week }))
    expect(screen.getByTestId('day-selector')).toBeInTheDocument()
  })

  it('carries no subtitle under the title', () => {
    render(planClient(planCoachingView(buildCoachingOverview(plan(), [], [], '2026-09-09'))))

    expect(screen.queryByTestId('plan-subtitle')).toBeNull()
    expect(screen.getByTestId('phase-line').textContent).toContain(t.plan.phase.raceInWeeks('10K', 6))
  })

  it('adds no coaching chrome to the header when no plan is active', () => {
    const { container } = renderPlan()

    expect(container.textContent).not.toMatch(/Garmin out of date/i)
    expect(screen.queryByTestId('race-footer')).not.toBeInTheDocument()
  })
})

describe('PlanClient selected day', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('opens on the day the URL names', () => {
    window.history.replaceState(null, '', '/plan?date=2026-09-17')
    renderPlan()

    expect(screen.getByRole('heading', { name: formatDateRange('2026-09-14', '2026-09-20') })).toBeInTheDocument()
    expect(screen.getByTestId('day-2026-09-17').getAttribute('aria-pressed')).toBe('true')
  })

  it('opens the month the URL asks for', () => {
    window.history.replaceState(null, '', '/plan?view=month&date=2026-10-21')
    renderPlan()

    expect(screen.getByRole('tab', { name: t.plan.switcher.month }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText(formatDate('2026-10-01', { precision: 'month', style: 'full', year: 'always' }))).toBeInTheDocument()
  })

  it('writes the selected day to the URL, and today as no date at all', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    window.history.replaceState(null, '', '/plan')
    renderPlan()

    await user.click(screen.getByTestId('day-2026-09-11'))
    expect(window.location.search).toBe('?date=2026-09-11')
    await user.click(screen.getByTestId('day-2026-09-09'))
    expect(window.location.search).toBe('')
  })

  it('pages a week at a time, landing on today in its own week', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    window.history.replaceState(null, '', '/plan?date=2026-09-01')
    renderPlan()

    await user.click(screen.getByRole('button', { name: t.plan.nextPeriod }))
    expect(window.location.search).toBe('')
    expect(screen.getByTestId('day-2026-09-09').getAttribute('aria-pressed')).toBe('true')
  })

  it('ignores a date that is no day', () => {
    expect(planDateParam('2026-02-30')).toBeNull()
    expect(planDateParam('tomorrow')).toBeNull()
    expect(planDateParam('2026-10-21')).toBe('2026-10-21')
  })
})

describe('PlanClient across midnight', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  // Built on Tuesday night, hydrated on Wednesday: the selected day and its
  // label must read the same clock.
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
