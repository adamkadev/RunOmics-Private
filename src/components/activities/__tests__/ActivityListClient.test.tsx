import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'
import { ActivityListClient } from '../ActivityListClient'
import { currentWeekTarget, planMaps } from '@/components/plan/weekPlanDays'

// Thursday 24 September 2026, in the week of Monday the 21st.
const NOW = new Date(2026, 8, 24, 12)

function run(id: string, date: string, distanceKm: number): ActivitySummary {
  return {
    id,
    date,
    dayOfWeek: 'Sunday',
    type: 'Base',
    description: `Run ${id}`,
    comment: '',
    distanceKm,
    durationSeconds: 3600,
    paceSecPerKm: 360,
    avgHeartRate: null,
    rpe: null,
    hrZones: [],
    week: 0,
    elevationGain: null,
    routeThumb: 'M10 10L40 40',
  }
}

function renderList(items: ActivitySummary[]) {
  return render(
    <ActivityListClient
      weekTarget={currentWeekTarget(planMaps(items, []), '2026-09-24', 40)}
      initialItems={items}
      initialNextOffset={null}
      totalCount={items.length}
      today="2026-09-24"
    />
  )
}

describe('the current week on /activities', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('counts none of last week toward this week before its first run', () => {
    renderList([run('a', '2026-09-20', 25), run('b', '2026-09-13', 10)])

    expect(screen.getByText(t.activities.thisWeek)).toBeInTheDocument()
    const line = screen.getByTestId('week-line').textContent
    expect(line).toContain(`0${t.activities.weekLine.ofKm('40')}`)
    expect(line).not.toContain('25')
  })

  it('shows last week as an ordinary row, open until this week has a run', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderList([run('a', '2026-09-20', 25), run('b', '2026-09-13', 10)])

    // A collapsible row under its own label, not the sticky current card.
    const lastWeek = screen.getByRole('button', { name: new RegExp(t.activities.lastWeek) })
    expect(screen.getByText('Run a')).toBeInTheDocument()
    expect(screen.queryByText('Run b')).not.toBeInTheDocument()

    await user.click(lastWeek)
    expect(screen.queryByText('Run a')).not.toBeInTheDocument()
  })

  it('counts this week toward its goal once it has a run', () => {
    renderList([run('c', '2026-09-22', 12), run('a', '2026-09-20', 25)])

    // H08, M8: one line, "12/40 km · 1 run · …", over the runs as flat rows.
    expect(screen.getByTestId('week-line').textContent).toContain(`12${t.activities.weekLine.ofKm('40')} · ${t.activities.weekLine.runs(1)}`)
    const card = screen.getByTestId('current-week')
    expect(card).toContainElement(screen.getByText('Run c'))
    expect(card.querySelector('[data-testid="route-thumb"]')).not.toBeNull()
  })
})

describe('a type this build does not know', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  // Activity JSON is cast, not parsed, so a new classifier type reaches the
  // list unchecked. It used to throw on the colour lookup and take the page
  // down; it draws as Base instead.
  it('still draws the week and the run', () => {
    renderList([{ ...run('h', '2026-09-22', 9), type: 'HillRepeats' as ActivityType }])

    expect(screen.getByText('Run h')).toBeInTheDocument()
    const path = screen.getByTestId('route-thumb').querySelector('path')!
    expect(path.getAttribute('stroke')).toBe('var(--zone-2)')
  })
})

