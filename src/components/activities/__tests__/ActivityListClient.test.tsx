import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'
import { ActivityListClient } from '../ActivityListClient'

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
  }
}

function renderList(items: ActivitySummary[]) {
  return render(
    <ActivityListClient
      weeklyGoal={{ targetKm: 40, actualKm: 0 }}
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
    expect(screen.getByText(t.activities.weekPlanned(0, 40))).toBeInTheDocument()
    expect(screen.queryByText(t.activities.weekPlanned(25, 40))).not.toBeInTheDocument()
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

    expect(screen.getByText(t.activities.weekPlanned(12, 40))).toBeInTheDocument()
    expect(screen.getByText('Run c')).toBeInTheDocument()
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
    expect(screen.getByRole('img', { name: '1 hillrepeats' })).toBeInTheDocument()
  })
})

