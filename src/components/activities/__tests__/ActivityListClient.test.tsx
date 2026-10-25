import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivitySummary, ActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'
import { ActivityListClient, activitiesView } from '../ActivityListClient'
import { encodeRouteThumb } from '@/domain/activity/routeThumb'
import { formatDate, formatDateRange, formatWeekday } from '@/lib/formatters'
import { notePopNavigation, popNavigationHandled } from '@/lib/popNavigation'

vi.mock('next/navigation', async (actual) => ({ ...(await actual<typeof import('next/navigation')>()), useRouter: () => ({ prefetch: () => {} }) }))

// The map is loaded with next/dynamic; here it is a stand-in that says what it was handed.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStandIn({ version }: { version: string }) {
      return <div data-testid="global-map">{version}</div>
    },
}))

const MAP = { version: '1.abc', clusterId: '0' }

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
    zones: [],
    routeThumb: encodeRouteThumb([[6.1, 49.6], [6.11, 49.61]]),
  }
}

function renderList(items: ActivitySummary[]) {
  return render(
    <ActivityListClient
      initialItems={items}
      totalCount={items.length}
      today="2026-09-24"
      map={MAP}
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

  it('leaves this week out until its first run', () => {
    renderList([run('a', '2026-09-20', 25), run('b', '2026-09-13', 10)])

    expect(screen.queryByText(t.activities.thisWeek)).not.toBeInTheDocument()
    expect(screen.queryByTestId('current-week')).not.toBeInTheDocument()
  })

  it('shows every week as a card of its runs', () => {
    renderList([run('a', '2026-09-20', 25), run('b', '2026-09-13', 10)])

    const weeks = screen.getAllByTestId('week')
    expect(weeks).toHaveLength(2)
    const range = formatDateRange('2026-09-14', '2026-09-20', { year: 'never' })
    expect(within(weeks[0]!).getByRole('heading', { name: range })).toBeInTheDocument()
    expect(within(weeks[0]!).getByText('Run a')).toBeInTheDocument()
    expect(within(weeks[1]!).getByText('Run b')).toBeInTheDocument()
  })

  it('writes the pace per km on a week', () => {
    renderList([run('a', '2026-09-20', 25)])
    expect(screen.getByTestId('thumb-row').textContent).toContain('6:00 /km')
  })

  it('counts this week once it has a run, over its runs as rows', () => {
    renderList([run('c', '2026-09-22', 12), run('a', '2026-09-20', 25)])

    const week = screen.getByTestId('current-week')
    const heading = within(week).getByRole('heading')
    expect(heading.textContent).toBe(t.activities.thisWeek)
    expect(heading.className).not.toContain('truncate')
    expect(heading.parentElement!.className).toContain('flex-wrap')
    expect(screen.getByTestId('week-line').textContent).toMatch(new RegExp(`^12 ${t.units.km} · ${t.activities.weekLine.runs(1)}`))
    expect(screen.queryByTestId('week-target-bar')).toBeNull()
    const card = screen.getByTestId('current-week')
    expect(card).toContainElement(screen.getByText('Run c'))
    expect(card.querySelector('[data-testid="route-thumb"]')).not.toBeNull()
  })
})

describe('a type this build does not know', () => {
  beforeEach(freshPage)
  afterEach(() => vi.useRealTimers())

  // Activity JSON is cast, not parsed, so a new classifier type reaches the
  // list unchecked; it draws as Base.
  it('still draws the week and the run', () => {
    renderList([{ ...run('h', '2026-09-22', 9), type: 'HillRepeats' as ActivityType }])

    expect(screen.getByText('Run h')).toBeInTheDocument()
    const path = screen.getByTestId('route-thumb').querySelector('path')!
    expect(path.getAttribute('stroke')).toBe('var(--zone-2)')
  })
})


describe('the archive under its months', () => {
  beforeEach(freshPage)
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const monthly = Array.from({ length: 12 }, (_, k) => run(`m${k}`, new Date(Date.UTC(2026, 8 - k, 10)).toISOString().slice(0, 10), 8))

  function observeEnd() {
    const watching = new Map<Element, IntersectionObserverCallback>()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(node: Element) {
        watching.set(node, this.callback)
      }
      disconnect() {
        for (const [node, callback] of watching) if (callback === this.callback) watching.delete(node)
      }
    })
    return () =>
      act(() => {
        for (const [node, callback] of watching) {
          if (node.isConnected) callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
        }
      })
  }

  it('renders its first months, and the rest as the end of the list comes near', async () => {
    const reachEnd = observeEnd()
    renderList(monthly)

    const firstMonths = screen.getAllByTestId('month').length
    expect(firstMonths).toBeLessThan(9)
    expect(screen.queryByText(t.activities.endOfList)).toBeNull()
    await reachEnd()
    expect(screen.getAllByTestId('month').length).toBeGreaterThan(firstMonths)
  })

  it('grows a list sorted by anything but date a few dozen runs at a time too', async () => {
    const reachEnd = observeEnd()
    window.history.replaceState(null, '', '/activities?sort=longest')
    const many = Array.from({ length: 120 }, (_, k) => run(`r${k}`, new Date(Date.UTC(2026, 8, 10) - k * 86_400_000).toISOString().slice(0, 10), 5 + k / 10))
    renderList(many)

    const first = screen.getAllByTestId('thumb-row').length
    expect(first).toBeLessThan(many.length)
    await reachEnd()
    expect(screen.getAllByTestId('thumb-row').length).toBeGreaterThan(first)
  })

  it('keeps loading older months after a trip to the map and back', async () => {
    const reachEnd = observeEnd()
    const user = userEvent.setup()
    renderList(monthly)
    const firstMonths = screen.getAllByTestId('month').length

    await user.click(screen.getByRole('tab', { name: t.activities.view.map }))
    await user.click(screen.getByRole('tab', { name: t.activities.view.list }))
    await reachEnd()

    expect(screen.getAllByTestId('month').length).toBeGreaterThan(firstMonths)
  })

  it('opened by Back, renders as far as it had been read', () => {
    observeEnd()
    sessionStorage.setItem('activities-shown-blocks', 'Infinity')
    notePopNavigation()
    renderList(monthly)
    popNavigationHandled()

    expect(screen.getByText(t.activities.endOfList)).toBeInTheDocument()
  })

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
    for (const line of screen.getAllByTestId('past-week-line')) expect(line.textContent).toMatch(new RegExp(t.activities.weekLine.runs(1)))
  })

  it('says how far back the archive goes', () => {
    renderList([run('a', '2026-09-20', 25), run('b', '2025-05-14', 10)])
    const since = t.activities.since(formatDate('2025-05-14', { precision: 'month', year: 'always' }))
    const line = screen.getByRole('heading', { level: 1 }).closest('header')!.querySelector('[data-title-sub]')!
    expect(line.textContent).toContain(since)
  })

  it('filters by four groups, without dots', () => {
    renderList([run('a', '2026-09-20', 25)])
    const rail = screen.getByTestId('type-chips')
    const names = within(rail).getAllByRole('button').map((b) => b.textContent)
    expect(names).toEqual([t.activities.all, t.activities.groups.easy, t.activities.groups.workouts, t.activities.groups.races])
    expect(rail.querySelector('span[aria-hidden]')).toBeNull()
  })

  it('lays the search field and the chip row each on one blur, the chips tint only', () => {
    renderList([run('a', '2026-09-20', 25)])
    const search = screen.getByPlaceholderText(t.activities.searchPlaceholder).closest('label')!
    const row = screen.getByTestId('type-chips').parentElement!
    for (const group of [search.parentElement!, row]) {
      expect(group.className).toContain('on-aura-group')
      expect(group.querySelectorAll(':scope > i.on-aura-blur')).toHaveLength(1)
      expect(group.querySelectorAll('.on-aura-blur')).toHaveLength(1)
    }
    expect(search.className).toContain('on-aura')
    const chips = within(screen.getByTestId('type-chips')).getAllByRole('button')
    expect(chips.filter((c) => c.className.includes('on-aura'))).toHaveLength(3)
    const selected = chips.find((c) => c.getAttribute('aria-pressed') === 'true')!
    expect(selected.className).toContain('bg-foreground')
    expect(selected.className).not.toContain('on-aura')
    expect(screen.getByRole('button', { name: t.activities.filter.title }).className).toContain('on-aura')
  })
})

describe('the list at a phone', () => {
  beforeEach(freshPage)
  afterEach(() => vi.useRealTimers())

  it('keeps no sort menu, and a 44 pt filter button', () => {
    renderList([run('a', '2026-09-20', 25)])

    expect(screen.queryByRole('button', { name: new RegExp(`^${t.activities.sort.label}`) })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.activities.filter.title }).className).toContain('hit-44')
  })

  it("writes a week's run as its day, time and heart rate, its type shown only to VoiceOver", () => {
    renderList([{ ...run('a', '2026-09-20', 12), avgHeartRate: 145 }])
    const row = screen.getByTestId('thumb-row')
    expect(row.textContent).toContain(`${formatWeekday('2026-09-20', true)} · 1:00:00 · 145 ${t.units.bpm}`)
    const shown = row.cloneNode(true) as HTMLElement
    shown.querySelectorAll('.sr-only').forEach((el) => el.remove())
    expect(shown.textContent).not.toContain(t.activityTypes.Base)
  })

  it('ellipses a long name', () => {
    const name = 'Long progressive Sunday run along the river with friends from the club'
    renderList([{ ...run('a', '2026-09-22', 10), description: name }])
    const title = screen.getByText(name)
    expect(title.className).toContain('truncate')
    expect(title.className).toContain('min-w-0')
  })

  it('names a structured session by its set, the meta line left to the date, time and HR', () => {
    const name = 'Threshold 3 × 7:40 - 3 × 8\'@4:25'
    renderList([{ ...run('a', '2026-09-22', 10), description: name }])
    expect(screen.getByText('3 × 8′ @ 4:25').className).toContain('truncate')
    expect(screen.getByText(`${formatWeekday('2026-09-22', true)} · 1:00:00`)).toBeInTheDocument()
    expect(screen.getByTestId('thumb-row').textContent).not.toContain('7:40')
  })
})

describe('the filter sheet', () => {
  beforeEach(() => {
    freshPage()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const archive = (): ActivitySummary[] => [
    { ...run('t1', '2026-09-20', 10), type: 'Threshold' },
    { ...run('t2', '2026-09-18', 12), type: 'Threshold' },
    { ...run('v1', '2026-09-16', 8), type: 'VO2Max' },
    run('b1', '2026-09-14', 9),
  ]

  const sheetUser = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const typeBox = (sheet: HTMLElement, type: ActivityType) =>
    within(sheet).getByRole('checkbox', { name: new RegExp(`^${t.activityTypes[type]}`) })
  const longRunBox = (sheet: HTMLElement) =>
    within(sheet).getByRole('checkbox', { name: new RegExp(t.activities.longRun) })

  async function openSheet(user: ReturnType<typeof sheetUser>) {
    await user.click(screen.getByRole('button', { name: t.activities.filter.title }))
    return screen.getByRole('dialog', { name: t.activities.filter.title })
  }

  it('counts each type and the runs the ticks would show', async () => {
    const user = sheetUser()
    renderList(archive())
    const sheet = await openSheet(user)

    expect(typeBox(sheet, 'Threshold').textContent).toContain('2')
    expect(within(sheet).getByRole('button', { name: t.activities.filter.showAll(4) })).toBeInTheDocument()

    await user.click(typeBox(sheet, 'Threshold'))
    await user.click(typeBox(sheet, 'VO2Max'))
    expect(within(sheet).getByRole('button', { name: t.activities.filter.show(3) })).toBeInTheDocument()
  })

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
    await waitFor(() => expect(screen.getAllByTestId('thumb-row')).toHaveLength(3))

    await user.click(chip)
    expect(window.location.search).toBe('')
    expect(screen.getByRole('button', { name: t.activities.all }).className).toContain('bg-foreground')
  })

  it("collapses a whole group's types back into its chip", async () => {
    const user = sheetUser()
    renderList(archive())
    const sheet = await openSheet(user)
    // Easy is the easy running and the long run together.
    await user.click(typeBox(sheet, 'Base'))
    await user.click(longRunBox(sheet))
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

  it('sorts by the longest run as a flat list', async () => {
    const user = sheetUser()
    renderList(archive())
    const sheet = await openSheet(user)
    await user.click(within(sheet).getByRole('tab', { name: t.activities.sort.longest }))
    await user.click(within(sheet).getByRole('button', { name: t.activities.filter.showAll(4) }))

    expect(new URLSearchParams(window.location.search).get('sort')).toBe('longest')
    await waitFor(() => expect(screen.queryAllByTestId('week')).toHaveLength(0))
    expect(screen.getAllByTestId('thumb-row').map((row) => row.getAttribute('href'))).toEqual(['/activities/t2', '/activities/t1', '/activities/b1', '/activities/v1'])
  })
})

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
    expect(screen.getByTestId('global-map').textContent).toBe(MAP.version)
    // The list's controls give way to the map.
    expect(screen.queryByPlaceholderText(t.activities.searchPlaceholder)).toBeNull()
    expect(screen.queryByRole('button', { name: t.activities.filter.title })).toBeNull()

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
