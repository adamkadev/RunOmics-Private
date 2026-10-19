import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'
import { ActivityListClient, activitiesView } from '../ActivityListClient'
import type { MapShellData } from '@/application/usecases/GetAllRoutes'
import { formatDate, formatDateRange } from '@/lib/formatters'

// The map is loaded with next/dynamic; here it is a stand-in that says what it was handed.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStandIn({ data }: { data: MapShellData }) {
      return <div data-testid="global-map">{data.totalCount}</div>
    },
}))

const MAP_DATA: MapShellData = { routeMeta: [], clusters: [], defaultClusterIdx: 0, totalCount: 7, totalKm: 70, years: ['2026'] }

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
      initialItems={items}
      initialNextOffset={null}
      totalCount={items.length}
      today="2026-09-24"
      mapData={MAP_DATA}
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

  // Design review, Oct 2026: "This week · Sep 21 – 27", its km and runs on
  // the right, and no plan target or bar.
  it('counts none of last week toward this week before its first run', () => {
    renderList([run('a', '2026-09-20', 25), run('b', '2026-09-13', 10)])

    const week = screen.getByTestId('current-week')
    expect(within(week).getByRole('heading').textContent).toBe(`${t.activities.thisWeek} · ${formatDateRange('2026-09-21', '2026-09-27', { year: 'never' })}`)
    expect(screen.getByTestId('week-line').textContent).toBe(`0 ${t.units.km} · ${t.activities.weekLine.runs(0)}`)
    expect(screen.queryByTestId('week-target-bar')).toBeNull()
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

  it('counts this week once it has a run, over its runs as rows', () => {
    renderList([run('c', '2026-09-22', 12), run('a', '2026-09-20', 25)])

    expect(screen.getByTestId('week-line').textContent).toBe(`12 ${t.units.km} · ${t.activities.weekLine.runs(1)}`)
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

describe('the list at a phone', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  // Design review, Oct 2026: the sort menu is a 44 pt icon button.
  it('gives the sort menu a 44 pt icon button with a name', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderList([run('a', '2026-09-20', 25)])

    const sort = screen.getByRole('button', { name: `${t.activities.sort.label}: ${t.activities.sort.date}` })
    expect(sort.className).toContain('size-11')
    expect(sort.textContent).toBe('')
    await user.click(sort)
    expect(screen.getByRole('button', { name: t.activities.sort.distance }).className).toContain('min-h-11')
  })

  // A week's dots are its runs' types in colour; a screen reader hears them
  // as the types they are (design review, Oct 2026).
  it("names a week's dots by their session types", () => {
    renderList([
      { ...run('a', '2026-09-20', 12), type: 'Threshold' },
      run('b', '2026-09-18', 8),
      run('c', '2026-09-16', 10),
    ])
    const week = formatDateRange('2026-09-14', '2026-09-20', { year: 'never' })
    const row = screen.getByRole('button', { name: new RegExp(`^${week}`) })
    const shape = `2 ${t.activityTypes.Base.toLowerCase()} · 1 ${t.activityTypes.Threshold.toLowerCase()}`
    expect(within(row).getByRole('img', { name: shape })).toBeInTheDocument()
  })

  // A legacy workout's long name wraps to two lines at most, never under the
  // distance beside it (design review, Oct 2026).
  it('clamps a long workout name to two lines', () => {
    const name = 'Threshold 3 × 7:40 - 3 × 8\'@4:25 with a long warm-up and a cool-down to finish'
    renderList([{ ...run('a', '2026-09-22', 10), description: name }])
    const title = screen.getByText(name)
    expect(title.className).toContain('line-clamp-2')
    expect(title.className).toContain('min-w-0')
  })
})

// Design review, Oct 2026: List | Map under the title, the view in the URL.
describe('List and Map', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState(null, '', '/activities')
  })
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('reads ?view=map as the map and anything else as the list', () => {
    expect(activitiesView('map')).toBe('map')
    expect(activitiesView(null)).toBe('list')
    expect(activitiesView('grid')).toBe('list')
  })

  it('opens on the list, and writes the map into the URL when chosen', async () => {
    const user = userEvent.setup()
    renderList([run('a', '2026-09-20', 25)])

    expect(screen.getByRole('tab', { name: t.activities.view.list }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('global-map')).toBeNull()

    await user.click(screen.getByRole('tab', { name: t.activities.view.map }))
    expect(window.location.search).toBe('?view=map')
    expect(screen.getByTestId('global-map').textContent).toBe('7')
    // The list's controls give way to the map.
    expect(screen.queryByPlaceholderText(t.activities.searchPlaceholder)).toBeNull()
    expect(screen.queryByRole('button', { name: new RegExp(t.activities.sort.label) })).toBeNull()

    await user.click(screen.getByRole('tab', { name: t.activities.view.list }))
    expect(window.location.search).toBe('')
    expect(screen.queryByTestId('global-map')).toBeNull()
  })

  it('opens on the map from a ?view=map link', () => {
    window.history.replaceState(null, '', '/activities?view=map')
    renderList([run('a', '2026-09-20', 25)])

    expect(screen.getByRole('tab', { name: t.activities.view.map }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('global-map')).toBeInTheDocument()
  })
})
