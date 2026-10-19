import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'
import { ActivityListClient } from '../ActivityListClient'
import { currentWeekTarget, planMaps } from '@/components/plan/weekPlanDays'
import { formatDate, formatDateRange, formatWeekday } from '@/lib/formatters'

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

// The filter and the sort live in the URL, which jsdom keeps between tests.
function freshPage() {
  sessionStorage.clear()
  window.history.replaceState(null, '', '/activities')
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
}

describe('the current week on /activities', () => {
  beforeEach(freshPage)
  afterEach(() => vi.useRealTimers())

  // 3.0: before this week's first run there is no "This week · 0 km" card.
  it('leaves this week out until its first run', () => {
    renderList([run('a', '2026-09-20', 25), run('b', '2026-09-13', 10)])

    expect(screen.queryByText(t.activities.thisWeek)).not.toBeInTheDocument()
    expect(screen.queryByTestId('current-week')).not.toBeInTheDocument()
  })

  // 3.0: every week is a card of its runs, none folded away.
  it('shows every week as a card of its runs', () => {
    renderList([run('a', '2026-09-20', 25), run('b', '2026-09-13', 10)])

    const weeks = screen.getAllByTestId('week')
    expect(weeks).toHaveLength(2)
    const range = formatDateRange('2026-09-14', '2026-09-20', { year: 'never' })
    expect(within(weeks[0]!).getByRole('heading', { name: range })).toBeInTheDocument()
    expect(within(weeks[0]!).getByText('Run a')).toBeInTheDocument()
    expect(within(weeks[1]!).getByText('Run b')).toBeInTheDocument()
  })

  // v4.17: a week's runs show their pace per km.
  it('writes the pace per km on a week', () => {
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
  beforeEach(freshPage)
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
  beforeEach(freshPage)
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

  // 3.0: four group chips, no dots.
  it('filters by four groups, without dots', () => {
    renderList([run('a', '2026-09-20', 25)])
    const rail = screen.getByTestId('type-chips')
    const names = within(rail).getAllByRole('button').map((b) => b.textContent)
    expect(names).toEqual([t.activities.all, t.activities.groups.easy, t.activities.groups.workouts, t.activities.groups.races])
    expect(rail.querySelector('span[aria-hidden]')).toBeNull()
  })
})

describe('the list at a phone', () => {
  beforeEach(freshPage)
  afterEach(() => vi.useRealTimers())

  // 3.0: List | Map replaces the header's Map view button and sort menu.
  it('switches to the map from List | Map, and keeps no sort menu', () => {
    renderList([run('a', '2026-09-20', 25)])

    const view = screen.getByRole('navigation', { name: t.activities.view.label })
    expect(within(view).getByText(t.activities.view.list).getAttribute('aria-current')).toBe('page')
    const map = within(view).getByRole('link', { name: t.activities.view.map })
    expect(map.getAttribute('href')).toBe('/map')
    expect(map.className).toContain('hit-44')
    expect(screen.queryByRole('button', { name: new RegExp(`^${t.activities.sort.label}`) })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.activities.filter.title }).className).toContain('hit-44')
  })

  // 3.0: "Sun 20 · 1:00:00 · 145 bpm" - the type is the dot beside it.
  it("writes a week's run as its day, time and heart rate", () => {
    renderList([{ ...run('a', '2026-09-20', 12), avgHeartRate: 145 }])
    const row = screen.getByTestId('thumb-row')
    expect(row.textContent).toContain(`${formatWeekday('2026-09-20', true)} · 1:00:00 · 145 ${t.units.bpm}`)
    expect(row.textContent).not.toContain(t.activityTypes.Base)
  })

  // A long name stays on one line in a week, ellipsed (3.0).
  it('ellipses a long workout name', () => {
    const name = 'Threshold 3 × 7:40 - 3 × 8\'@4:25 with a long warm-up and a cool-down to finish'
    renderList([{ ...run('a', '2026-09-22', 10), description: name }])
    const title = screen.getByText(name)
    expect(title.className).toContain('truncate')
    expect(title.className).toContain('min-w-0')
  })
})

describe('the filter sheet', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    freshPage()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ json: async () => ({ items: [], total: 0, nextOffset: null }) })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const archive = (): ActivitySummary[] => [
    { ...run('t1', '2026-09-20', 10), type: 'Threshold' },
    { ...run('t2', '2026-09-18', 12), type: 'Threshold' },
    { ...run('v1', '2026-09-16', 8), type: 'VO2Max' },
    run('b1', '2026-09-14', 9),
  ]

  const sheetUser = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const typeBox = (sheet: HTMLElement, type: ActivityType) =>
    within(sheet).getByRole('checkbox', { name: new RegExp(t.activityTypes[type]) })

  async function openSheet(user: ReturnType<typeof sheetUser>) {
    await user.click(screen.getByRole('button', { name: t.activities.filter.title }))
    return screen.getByRole('dialog', { name: t.activities.filter.title })
  }

  it('counts each type and the runs the ticks would show', async () => {
    const user = sheetUser()
    renderList(archive())
    const sheet = await openSheet(user)

    expect(typeBox(sheet, 'Threshold').textContent).toContain('2')
    expect(within(sheet).getByRole('button', { name: t.activities.filter.show(4) })).toBeInTheDocument()

    await user.click(typeBox(sheet, 'Threshold'))
    await user.click(typeBox(sheet, 'VO2Max'))
    expect(within(sheet).getByRole('button', { name: t.activities.filter.show(3) })).toBeInTheDocument()
  })

  // 3.0: picked types stand in for the groups as one chip whose ✕ clears them.
  it('applies picked types as one removable chip, kept in the URL', async () => {
    const user = sheetUser()
    renderList(archive())
    const sheet = await openSheet(user)
    await user.click(typeBox(sheet, 'Threshold'))
    await user.click(typeBox(sheet, 'VO2Max'))
    await user.click(within(sheet).getByRole('button', { name: t.activities.filter.show(3) }))

    const label = `${t.activityTypes.Threshold}, ${t.activityTypes.VO2Max}`
    const chip = await screen.findByRole('button', { name: t.activities.filter.clearTypes(label) })
    expect(within(screen.getByTestId('type-chips')).getAllByRole('button')).toHaveLength(1)
    expect(new URLSearchParams(window.location.search).get('types')).toBe('Threshold,VO2Max')
    await waitFor(() => expect(String(fetchMock.mock.lastCall?.[0])).toContain('types=Threshold%2CVO2Max'))

    await user.click(chip)
    expect(window.location.search).toBe('')
    expect(screen.getByRole('button', { name: t.activities.all }).className).toContain('bg-foreground')
  })

  it("collapses a whole group's types back into its chip", async () => {
    const user = sheetUser()
    renderList(archive())
    const sheet = await openSheet(user)
    await user.click(typeBox(sheet, 'Base'))
    await user.click(within(sheet).getByRole('button', { name: t.activities.filter.show(1) }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: t.activities.groups.easy }).getAttribute('aria-pressed')).toBe('true')
    expect(new URLSearchParams(window.location.search).get('group')).toBe('easy')
  })

  it("opens on the chip's group ticked, and Reset clears the ticks and the sort", async () => {
    const user = sheetUser()
    window.history.replaceState(null, '', '/activities?group=workouts&sort=longest')
    renderList(archive())
    const sheet = await openSheet(user)
    expect(typeBox(sheet, 'Tempo').getAttribute('aria-checked')).toBe('true')
    expect(within(sheet).getByRole('tab', { name: t.activities.sort.longest }).getAttribute('aria-selected')).toBe('true')

    await user.click(within(sheet).getByRole('button', { name: t.activities.filter.reset }))
    expect(within(sheet).queryAllByRole('checkbox', { checked: true })).toHaveLength(0)
    expect(within(sheet).getByRole('tab', { name: t.activities.sort.newest }).getAttribute('aria-selected')).toBe('true')
  })

  // Longest and Fastest are one ranked list, with no weeks.
  it('sorts by the longest run as a flat list', async () => {
    const user = sheetUser()
    fetchMock.mockResolvedValue({ json: async () => ({ items: archive(), total: 4, nextOffset: null }) })
    renderList(archive())
    const sheet = await openSheet(user)
    await user.click(within(sheet).getByRole('tab', { name: t.activities.sort.longest }))
    await user.click(within(sheet).getByRole('button', { name: t.activities.filter.show(4) }))

    await waitFor(() => expect(String(fetchMock.mock.lastCall?.[0])).toContain('sortBy=distance'))
    expect(new URLSearchParams(window.location.search).get('sort')).toBe('longest')
    await waitFor(() => expect(screen.queryAllByTestId('week')).toHaveLength(0))
    expect(screen.getAllByTestId('thumb-row')).toHaveLength(4)
  })
})
