import { act, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps, ReactNode } from 'react'
import type { ActivityDetailView } from '../activityViews'
import { t } from '@/i18n'
import { formatDistance } from '@/lib/formatters'

vi.mock('../ActivityMapClient', () => ({
  ActivityMapClient: ({ fullscreen, card }: { fullscreen?: boolean; card?: ReactNode }) => (
    <div data-testid="map" data-fullscreen={fullscreen ? '' : undefined}>{fullscreen && card}</div>
  ),
}))
vi.mock('../RunPlace', () => ({ RunPlace: () => null }))
vi.mock('@/lib/firebaseConfig', () => ({ isClientFirebaseConfigured: false }))
vi.mock('@/lib/useOwnerAuth', () => ({ useOwnerAuth: () => ({ isOwner: true }) }))

// jsdom lays nothing out, so whether the tabs are pinned, and where they rest, are set here.
const strip = vi.hoisted(() => ({ pinned: false, restingTop: 0 }))
vi.mock('@/lib/useStuck', () => ({
  isStuck: () => strip.pinned,
  restingTop: () => strip.restingTop,
  useStuck: () => false,
}))

const { ActivityDetailClient } = await import('../ActivityDetailClient')

const ACTIVITY = {
  id: 'a1',
  type: 'Threshold',
  rpe: null,
  distanceKm: 6.11,
  durationSeconds: 1_524,
  paceSecPerKm: 250,
  avgHeartRate: 115,
  hrZones: [],
  splits: [{ type: 'lap', durationSec: 244, distanceM: 1_000, avgSpeedMs: 4.1, avgHr: 116, laps: [] }],
  hrSamples: [110, 115, 120],
} as unknown as ActivityDetailView

type DetailProps = ComponentProps<typeof ActivityDetailClient>

function renderDetail(props: Partial<DetailProps> = {}) {
  return render(
    <ActivityDetailClient
      activity={ACTIVITY}
      name="Threshold run"
      dateLabel="Sun, Oct 18"
      aiVerdict={null}
      dynamicsBaseline={null}
      {...props}
    />,
  )
}

describe('ActivityDetailClient', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
    strip.pinned = false
    strip.restingTop = 0
    vi.restoreAllMocks()
  })

  it('keeps the run in reading order: map, title, stats, verdict, tabs', () => {
    const { container } = renderDetail({ activity: { ...ACTIVITY, route: [[6.17, 49.12], [6.18, 49.13]] } as ActivityDetailView })
    const order = ['run-hero', 'activity-subtitle', 'run-stats', 'run-verdict', 'sticky-bar'].map((id) => screen.getByTestId(id))
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(container.querySelector('h1')!.textContent).toBe('Threshold run')
    expect(screen.getByTestId('activity-subtitle').textContent).toContain(`${t.activityTypes.Threshold}·Sun, Oct 18`)
  })

  it('leaves the type to its dot when the title is the type alone', () => {
    renderDetail({ activity: { ...ACTIVITY, type: 'Tempo' } as ActivityDetailView, name: 'Base', shownType: 'Base' })
    const line = screen.getByTestId('activity-subtitle').textContent ?? ''
    expect(line.startsWith('Sun, Oct 18')).toBe(true)
    expect(line).not.toContain(t.activityTypes.Tempo)
  })

  it("names the session's type over the title where it is not the watch's", () => {
    renderDetail({ activity: { ...ACTIVITY, type: 'Tempo' } as ActivityDetailView, shownType: 'Threshold' })
    expect(screen.getByTestId('activity-subtitle').textContent).toContain(`${t.activityTypes.Threshold}·Sun, Oct 18`)
    expect(screen.getByTestId('activity-subtitle').textContent).not.toContain(t.activityTypes.Tempo)
  })

  it('shows the four numbers once, as a four-column strip', () => {
    strip.pinned = true
    renderDetail()
    const stats = screen.getByTestId('run-stats')
    expect(stats.textContent).toBe(
      `${formatDistance(6.11)}${t.units.km}${t.activity.stats.distance}25:24${t.units.min}${t.activity.stats.duration}4:10${t.units.perKm}${t.activity.stats.pace}115${t.units.bpm}${t.activity.stats.avgHr}`,
    )
    expect(stats.className).toContain('grid-cols-[repeat(4,minmax(0,1fr))]')
    expect(stats.className).toContain('gap-x-2')
    expect(screen.queryByTestId('run-summary')).toBeNull()
    expect(screen.getAllByText(t.activity.stats.distance)).toHaveLength(1)
  })

  it('reads a run of an hour or more to the minute, as the share card does', () => {
    renderDetail({ activity: { ...ACTIVITY, durationSeconds: 5_270 } })
    const time = screen.getByTestId('run-stats').querySelectorAll<HTMLElement>('[data-stat-value]')[1]!

    expect(time.textContent).toBe(`1:28${t.units.hour}`)
  })

  it('puts every value in one fixed row and every label in the next', () => {
    renderDetail()
    const stats = screen.getByTestId('run-stats')
    expect(stats.className).toContain('grid-rows-[44px_auto]')
    expect(stats.className).toContain('grid-flow-col')
    expect(stats.className).not.toContain('items-center')
    const values = [...stats.querySelectorAll<HTMLElement>('[data-stat-value]')]
    const labels = [...stats.querySelectorAll<HTMLElement>('[data-stat-label]')]
    expect(values).toHaveLength(4)
    expect(labels.map((l) => l.textContent)).toEqual([t.activity.stats.distance, t.activity.stats.duration, t.activity.stats.pace, t.activity.stats.avgHr])
    for (const value of values) {
      expect(value.className).toMatch(/\bh-8\b/)
      expect(value.className).toContain('leading-8')
      expect(value.className).toContain('self-end')
      expect(value.className).toContain('text-[length:min(28px,')
      expect(value.nextElementSibling?.hasAttribute('data-stat-label')).toBe(true)
    }
    expect(values[0]!.querySelector('span')!.className).toContain('leading-none')
    expect(labels[0]!.className).toContain('text-[15px]')
  })

  it('reads Effort, conditions, shoe and note as chips in the verdict card', () => {
    const weather = { tempC: 18, apparentTempC: 18, humidityPct: 60, windKph: 2, windDirDeg: 0, precipitationMm: 0, code: 0 }
    renderDetail({ activity: { ...ACTIVITY, rpe: 1, weather } as ActivityDetailView, shoe: { gearId: 'v1', name: 'Vomero Plus', dotColor: '#fff' } })
    const chips = within(screen.getByTestId('run-chips'))
    expect(chips.getByTestId('run-effort').textContent).toBe(t.activities.row.rpeValue(1))
    expect(chips.getAllByTestId('run-conditions').map((chip) => chip.textContent)).toEqual(['Clear sky · 18°C', 'wind 2 km/h N'])
    expect(chips.getByTestId('run-shoe').textContent).toBe('Vomero Plus')
    expect(chips.getByTestId('note-row')).toBeInTheDocument()
  })

  it('hides conditions without weather', () => {
    renderDetail()
    expect(screen.queryByTestId('run-conditions')).toBeNull()
  })

  it('asks to add a shoe on a run the watch has a page for', () => {
    renderDetail({ activity: { ...ACTIVITY, id: '90000276' } as ActivityDetailView })
    const chip = screen.getByTestId('run-shoe')
    expect(chip.textContent).toBe(t.activity.shoe.add)
    expect(chip.getAttribute('href')).toBe('https://connect.garmin.com/modern/activity/90000276')
    expect(chip.getAttribute('aria-label')).toBe(t.activity.shoe.addInGarmin)
  })

  it('asks for no shoe while the sync has yet to read it from Garmin', () => {
    renderDetail({ activity: { ...ACTIVITY, id: '90000276', gearPending: true } as ActivityDetailView })
    expect(screen.queryByTestId('run-shoe')).toBeNull()
  })

  it('reads the pair without a link on a run the watch never gave an id', () => {
    renderDetail({ shoe: { gearId: 'v1', name: 'Vomero Plus', dotColor: '#fff' } })
    const chip = screen.getByTestId('run-shoe')
    expect(chip.textContent).toBe('Vomero Plus')
    expect(chip.getAttribute('href')).toBeNull()
  })

  it('draws no shoe chip at all without a pair and without a page to open', () => {
    renderDetail()
    expect(screen.queryByTestId('run-shoe')).toBeNull()
  })

  it('says RPE was not logged rather than inventing one', () => {
    renderDetail()
    expect(screen.getByTestId('run-effort').textContent).toBe(`${t.activity.effort.label} ${t.activity.effort.notLogged}`)
  })

  // Going back to the run must land on the tab it was left on, not Overview.
  it('keeps the selected tab in ?tab=', () => {
    renderDetail()

    act(() => screen.getByRole('tab', { name: t.activity.tabs.charts }).click())
    expect(window.location.search).toBe('?tab=charts')
    expect(screen.getByRole('tab', { name: t.activity.tabs.charts })).toHaveAttribute('aria-selected', 'true')
  })

  it("ends every tab's panel with the footer, so a short tab's height falls below it", () => {
    renderDetail({ footer: <nav data-testid="footer" /> })
    for (const name of [t.activity.tabs.overview, t.activity.tabs.charts]) {
      act(() => screen.getByRole('tab', { name }).click())
      expect(screen.getByTestId('activity-panel').lastElementChild).toBe(screen.getByTestId('footer'))
    }
  })

  it('opens the Overview with the best efforts when the run holds a ranked one, and ends it with them otherwise', () => {
    const activity = { ...ACTIVITY, bestEfforts: { '5k': 1_200 } } as ActivityDetailView
    const extras = <div data-testid="extras" />
    const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    const { unmount } = renderDetail({ activity, extras, qualifiedEfforts: [{ key: '5k', label: '5K', rank: 2 }] })
    expect(before(screen.getByTestId('best-efforts'), screen.getByTestId('extras'))).toBe(true)
    unmount()

    renderDetail({ activity, extras, qualifiedEfforts: [] })
    expect(before(screen.getByTestId('extras'), screen.getByTestId('best-efforts'))).toBe(true)
  })

  it('opens on the tab the URL names', () => {
    window.history.replaceState(null, '', '/activities/a1?tab=intervals')
    renderDetail()

    expect(screen.getByRole('tab', { name: t.activity.tabs.intervals })).toHaveAttribute('aria-selected', 'true')
  })

  // So a tab switch never moves the page under the hero.
  it('keeps the map, title, numbers and verdict above every tab', () => {
    window.history.replaceState(null, '', '/activities/a1?tab=intervals')
    renderDetail({ activity: { ...ACTIVITY, route: [[6.17, 49.12], [6.18, 49.13]] } as ActivityDetailView })

    expect(screen.getByRole('heading', { name: 'Threshold run' })).toBeInTheDocument()
    expect(within(screen.getByTestId('run-hero')).getByTestId('map')).toBeInTheDocument()
    expect(screen.getByTestId('run-stats')).toBeInTheDocument()
    expect(screen.getByTestId('run-verdict')).toBeInTheDocument()
  })

  it('floats back, expand and share on the map, and expand opens it full screen', () => {
    renderDetail({
      activity: { ...ACTIVITY, route: [[6.17, 49.12], [6.18, 49.13]], elevationGain: 64.4 } as ActivityDetailView,
      back: <button type="button">back</button>,
      share: <button type="button">share</button>,
    })
    const hero = within(screen.getByTestId('run-hero'))
    expect(hero.getAllByRole('button').map((b) => b.textContent || b.getAttribute('aria-label'))).toEqual(['back', t.activity.map.fullscreen, 'share'])

    act(() => hero.getByRole('button', { name: t.activity.map.fullscreen }).click())
    expect(hero.getByTestId('map').hasAttribute('data-fullscreen')).toBe(true)
    expect(hero.getByTestId('map').textContent).toContain('Threshold runSun, Oct 18')
    expect(hero.getByTestId('map-card-stats').textContent).toBe(
      `${formatDistance(6.11)}${t.units.km}${t.activity.map.stats.distance}25:24${t.units.min}${t.activity.map.stats.time}4:10${t.units.perKm}${t.activity.map.stats.pace}+64${t.units.m}${t.activity.map.stats.elevation}`,
    )
  })

  it('offers no expand button without a route', () => {
    renderDetail()
    expect(screen.queryByRole('button', { name: t.activity.map.fullscreen })).toBeNull()
    expect(screen.getByText(t.activity.map.noTrace)).toBeInTheDocument()
  })

  it('keeps pinned tabs pinned across a switch, the new tab from its top', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    strip.pinned = true
    strip.restingTop = 480
    renderDetail()

    act(() => screen.getByRole('tab', { name: t.activity.tabs.intervals }).click())
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 480, behavior: 'instant' })
  })

  it('makes the panel tall enough for the strip to pin on a short tab', () => {
    renderDetail()
    act(() => screen.getByRole('tab', { name: t.activity.tabs.intervals }).click())
    expect(screen.getByTestId('activity-panel').className).toContain('max-lg:min-h-[calc(100dvh')
  })

  it('leaves the page where it is on a switch lower down that hides nothing', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    strip.restingTop = 480
    renderDetail()

    act(() => screen.getByRole('tab', { name: t.activity.tabs.intervals }).click())
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('heads the verdict with one accent label: how it went and what it was', () => {
    renderDetail({ activity: { ...ACTIVITY, rpe: 7 } as ActivityDetailView })

    const session = t.activity.verdict.headline.positive(t.activityTypes[ACTIVITY.type])
    const eyebrow = screen.getByText(`${t.activity.verdict.eyebrow.positive} · ${session}`)
    expect(eyebrow.getAttribute('style')).toContain('--accent-text')
  })
})
