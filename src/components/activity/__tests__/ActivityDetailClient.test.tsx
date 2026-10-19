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

// jsdom lays nothing out, so whether the tabs are pinned, and where they rest,
// are set here.
const strip = vi.hoisted(() => ({ pinned: false, restingTop: 0 }))
vi.mock('@/lib/useStuck', () => ({
  isStuck: () => strip.pinned,
  restingTop: () => strip.restingTop,
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

  // 3.0: map, title, the four numbers, the verdict with its chips, then the
  // tabs right after it.
  it('keeps the run in reading order: map, title, stats, verdict, tabs', () => {
    const { container } = renderDetail({ activity: { ...ACTIVITY, route: [[6.17, 49.12], [6.18, 49.13]] } as ActivityDetailView })
    const order = ['run-hero', 'activity-subtitle', 'run-stats', 'run-verdict', 'sticky-bar'].map((id) => screen.getByTestId(id))
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(container.querySelector('h1')!.textContent).toBe('Threshold run')
    // Type · date above the 30 pt title.
    expect(screen.getByTestId('activity-subtitle').textContent).toContain(`${t.activityTypes.Threshold}·Sun, Oct 18`)
  })

  // 3.0 cut the 2 x 2 card under the map and the strip pinned under the tabs:
  // one strip of four numbers.
  it('shows the four numbers once, as a four-column strip', () => {
    strip.pinned = true
    renderDetail()
    const stats = screen.getByTestId('run-stats')
    expect(stats.textContent).toBe(
      `${formatDistance(6.11)}${t.units.km}${t.activity.stats.distance}25${t.units.min}${t.activity.stats.duration}4:10${t.units.perKm}${t.activity.stats.pace}115${t.units.bpm}${t.activity.stats.avgHr}`,
    )
    expect(stats.className).toContain('grid-cols-4')
    expect(screen.queryByTestId('run-summary')).toBeNull()
    expect(screen.getAllByText(t.activity.stats.distance)).toHaveLength(1)
  })

  // 3.0: the four full-width rows became one row of chips.
  it('reads Effort, conditions, shoe and note as chips in the verdict card', () => {
    const weather = { tempC: 18, apparentTempC: 18, humidityPct: 60, windKph: 2, windDirDeg: 0, precipitationMm: 0, code: 0 }
    renderDetail({ activity: { ...ACTIVITY, rpe: 1, weather } as ActivityDetailView, shoe: { name: 'Vomero Plus', dotColor: '#fff' } })
    const chips = within(screen.getByTestId('run-chips'))
    expect(chips.getByTestId('run-effort').textContent).toBe(t.activities.row.rpeValue(1))
    expect(chips.getByTestId('run-conditions').textContent).toBe('18°C · wind 2 km/h N')
    expect(chips.getByTestId('run-shoe').textContent).toBe('Vomero Plus')
    expect(chips.getByTestId('note-row')).toBeInTheDocument()
  })

  it('hides conditions without weather and asks to add a shoe without one', () => {
    renderDetail()
    expect(screen.queryByTestId('run-conditions')).toBeNull()
    expect(screen.getByTestId('run-shoe').textContent).toBe(t.activity.shoe.add)
    expect(screen.getByTestId('run-shoe').getAttribute('href')).toBe('https://connect.garmin.com/modern/activity/a1')
  })

  it('says RPE was not logged rather than inventing one', () => {
    renderDetail()
    expect(screen.getByTestId('run-effort').textContent).toBe(`${t.activity.effort.label} ${t.activity.effort.notLogged}`)
  })

  // The tab lived in useState: going back from Charts reset it to Overview.
  it('keeps the selected tab in ?tab=', () => {
    renderDetail()

    act(() => screen.getByRole('tab', { name: t.activity.tabs.charts }).click())
    expect(window.location.search).toBe('?tab=charts')
    expect(screen.getByRole('tab', { name: t.activity.tabs.charts })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens on the tab the URL names', () => {
    window.history.replaceState(null, '', '/activities/a1?tab=intervals')
    renderDetail()

    expect(screen.getByRole('tab', { name: t.activity.tabs.intervals })).toHaveAttribute('aria-selected', 'true')
  })

  // 3.0: everything above the tabs is the same on every tab, so a switch
  // never moves the page under the hero.
  it('keeps the map, title, numbers and verdict above every tab', () => {
    window.history.replaceState(null, '', '/activities/a1?tab=intervals')
    renderDetail({ activity: { ...ACTIVITY, route: [[6.17, 49.12], [6.18, 49.13]] } as ActivityDetailView })

    expect(screen.getByRole('heading', { name: 'Threshold run' })).toBeInTheDocument()
    expect(within(screen.getByTestId('run-hero')).getByTestId('map')).toBeInTheDocument()
    expect(screen.getByTestId('run-stats')).toBeInTheDocument()
    expect(screen.getByTestId('run-verdict')).toBeInTheDocument()
  })

  // The hero's buttons: back on the left, expand and share on the right.
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
    // The floating card: name, date, then distance, time, pace and the climb.
    expect(hero.getByTestId('map').textContent).toContain('Threshold runSun, Oct 18')
    expect(hero.getByTestId('map-card-stats').textContent).toBe(
      `${formatDistance(6.11)}${t.units.km}${t.activity.map.stats.distance}25${t.units.min}${t.activity.map.stats.time}4:10${t.units.perKm}${t.activity.map.stats.pace}+64${t.units.m}${t.activity.map.stats.elevation}`,
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

  it('leaves the page where it is on a switch lower down that hides nothing', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    strip.restingTop = 480
    renderDetail()

    act(() => screen.getByRole('tab', { name: t.activity.tabs.intervals }).click())
    expect(scrollTo).not.toHaveBeenCalled()
  })

  // v4.17: the insight's eyebrow says how the session went, in its status colour.
  it('heads the verdict with one accent label: how it went and what it was', () => {
    renderDetail({ activity: { ...ACTIVITY, rpe: 7 } as ActivityDetailView })

    const session = t.activity.verdict.headline.positive(t.activityTypes[ACTIVITY.type])
    const eyebrow = screen.getByText(`${t.activity.verdict.eyebrow.positive} · ${session}`)
    expect(eyebrow.getAttribute('style')).toContain('--accent-text')
  })
})
