import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'
import { ActivityListClient } from '../ActivityListClient'
import { currentWeekTarget, planMaps } from '@/components/plan/weekPlanDays'
import { formatDate, formatDateRange } from '@/lib/formatters'

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

    // A collapsible row under its date range (v4.17), not the current card.
    const range = formatDateRange('2026-09-14', '2026-09-20', { year: 'never' })
    const lastWeek = screen.getByRole('button', { name: new RegExp(`^${range}`) })
    expect(screen.getByText('Run a')).toBeInTheDocument()
    expect(screen.queryByText('Run b')).not.toBeInTheDocument()

    await user.click(lastWeek)
    expect(screen.queryByText('Run a')).not.toBeInTheDocument()
  })

  // v4.17: the open week's runs show their pace per km.
  it('writes the pace per km on an open week', () => {
    renderList([run('a', '2026-09-20', 25)])
    expect(screen.getByTestId('thumb-row').textContent).toContain('6:00 /km')
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


describe('the archive under its months', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  // v4.17: sticky month headings, each totalling the weeks under it - a week
  // sits under the month it starts in.
  it('heads the weeks with their month and its total', () => {
    renderList([
      run('a', '2026-09-20', 25),
      run('b', '2026-09-13', 10),
      run('c', '2026-09-01', 8),
      run('d', '2026-08-30', 12),
      run('e', '2026-08-12', 5.4),
    ])

    const months = screen.getAllByTestId('month')
    expect(months).toHaveLength(2)
    expect(months[0]!.textContent).toContain(formatDate('2026-09-01', { precision: 'month', year: 'always', style: 'full' }))
    expect(within(months[0]!).getByTestId('month-line').textContent).toBe(`35 ${t.units.km} · ${t.activities.weekLine.runs(2)}`)
    // Aug 31 - Sep 6 starts in August, so it counts there.
    expect(within(months[1]!).getByTestId('month-line').textContent).toBe(`25 ${t.units.km} · ${t.activities.weekLine.runs(3)}`)
    // Every week spells its line out.
    for (const line of screen.getAllByTestId('past-week-line')) expect(line.textContent).toMatch(new RegExp(t.activities.weekLine.runs(1)))
  })

  it('says how far back the archive goes', () => {
    renderList([run('a', '2026-09-20', 25), run('b', '2025-05-14', 10)])
    const since = t.activities.since(formatDate('2025-05-14', { precision: 'month', year: 'always' }))
    expect(screen.getByRole('heading', { level: 1 }).nextElementSibling!.textContent).toContain(since)
  })

  // v4.17: each type chip carries its category dot, a race its ring.
  it('dots each type chip with its category', () => {
    renderList([run('a', '2026-09-20', 25)])
    const rail = within(screen.getByRole('button', { name: t.activities.all }).parentElement!)
    const tempo = rail.getByRole('button', { name: t.activityTypes.Tempo })
    expect((tempo.querySelector('span[aria-hidden]') as HTMLElement).style.backgroundColor).toBe('var(--zone-3)')
    const race = rail.getByRole('button', { name: t.activityTypes.Race })
    const ring = race.querySelector('span[aria-hidden]') as HTMLElement
    expect(ring.style.background).toBe('transparent')
    expect(ring.style.border).toContain('var(--zone-5)')
  })
})
