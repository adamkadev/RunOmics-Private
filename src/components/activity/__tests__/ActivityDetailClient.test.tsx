import { act, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActivityDetailView } from '../activityViews'
import { t } from '@/i18n'
import { formatDistance } from '@/lib/formatters'

vi.mock('../ActivityMapClient', () => ({ ActivityMapClient: () => <div data-testid="map" /> }))
vi.mock('@/lib/firebaseConfig', () => ({ isClientFirebaseConfigured: false }))
vi.mock('@/lib/useOwnerAuth', () => ({ useOwnerAuth: () => ({ isOwner: false }) }))

// jsdom lays nothing out, so whether the tabs are pinned, and where they rest,
// are set here.
const strip = vi.hoisted(() => ({ pinned: false, restingTop: 0 }))
vi.mock('@/lib/useStuck', () => ({
  useStuck: () => strip.pinned,
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

function renderDetail() {
  return render(
    <ActivityDetailClient
      activity={ACTIVITY}
      aiVerdict={null}
      dynamicsBaseline={null}
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

  // Similar runs and the map filled the first screen; the run's own stats,
  // RPE and note were on the second or on none.
  // H10: verdict, effort and note in one card, then the tabs. The planned-
  // against-ran row is gone at the owner's request: it took space for nothing.
  it('orders the run first: stats, verdict, effort and note, then tabs', () => {
    renderDetail()
    const card = screen.getByTestId('run-verdict')
    expect(card.textContent).not.toContain(t.sessionCard.onPlan)
    expect(card.textContent).toContain(t.activity.effort.label)
    expect(card.textContent).toContain(t.activity.noteRow.label)
  })

  it('keeps the run in reading order', () => {
    const { container } = renderDetail()
    const text = container.textContent ?? ''
    const at = (s: string) => text.indexOf(s)

    expect(at(t.activity.stats.distance)).toBeLessThan(at(t.activity.effort.label))
    expect(at(t.activity.effort.label)).toBeLessThan(at(t.activity.noteRow.label))
    expect(at(t.activity.noteRow.label)).toBeLessThan(at(t.activity.tabs.overview))
  })

  // v4.8 2h: the chips left the map for the verdict card.
  it('reads Effort · Conditions · Shoe · Note in the verdict card', () => {
    const weather = { tempC: 18, apparentTempC: 18, humidityPct: 60, windKph: 2, windDirDeg: 0, precipitationMm: 0, code: 0 }
    render(
      <ActivityDetailClient
        activity={{ ...ACTIVITY, weather } as ActivityDetailView}
        aiVerdict={null}
        dynamicsBaseline={null}
        shoe={{ name: 'Vomero Plus', dotColor: '#fff' }}
      />,
    )
    const text = screen.getByTestId('run-verdict').textContent ?? ''
    const at = (s: string) => text.indexOf(s)
    expect(at(t.activity.effort.label)).toBeLessThan(at(t.activity.conditions.label))
    expect(at(t.activity.conditions.label)).toBeLessThan(at(t.activity.shoe.label))
    expect(at(t.activity.shoe.label)).toBeLessThan(at(t.activity.noteRow.label))
    expect(screen.getByTestId('run-conditions').textContent).toContain('18°C · wind 2 km/h N')
    expect(screen.getByTestId('run-shoe').textContent).toContain('Vomero Plus ›')
  })

  it('hides Conditions without weather and asks to add a shoe without one', () => {
    renderDetail()
    expect(screen.queryByTestId('run-conditions')).toBeNull()
    expect(screen.getByTestId('run-shoe').textContent).toContain(`${t.activity.shoe.add} ›`)
    expect(screen.getByTestId('run-shoe').getAttribute('href')).toBe('https://connect.garmin.com/modern/activity/a1')
  })

  it('says RPE was not logged rather than inventing one', () => {
    renderDetail()

    expect(screen.getByText(t.activity.effort.notLogged)).toBeInTheDocument()
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

  // H16: one header - '← Activities', the big title, share - on every tab,
  // and the four stats under it; the verdict stays on Overview.
  it('keeps the same header and the four stats above every tab', () => {
    window.history.replaceState(null, '', '/activities/a1?tab=intervals')
    render(<ActivityDetailClient activity={ACTIVITY} aiVerdict={null} dynamicsBaseline={null} header={<h1>Threshold</h1>} />)

    expect(screen.getByRole('heading', { name: 'Threshold' })).toBeInTheDocument()
    expect(screen.getByTestId('run-map-card').textContent).toContain(t.activity.stats.distance)
    expect(screen.queryByText(t.activity.effort.label)).toBeNull()
    expect(screen.queryByTestId('compact-header')).toBeNull()
  })

  // Design review, Oct 2026: the map pushed Splits, Charts and Dynamics off
  // the first screen. It opens with the run, and collapses on a switch.
  it('shows the map on Overview and collapses it on the other tabs', () => {
    render(<ActivityDetailClient activity={{ ...ACTIVITY, route: [[6.17, 49.12], [6.18, 49.13]] } as ActivityDetailView} aiVerdict={null} dynamicsBaseline={null} />)
    expect(within(screen.getByTestId('run-map-card')).getByTestId('map')).toBeInTheDocument()

    act(() => screen.getByRole('tab', { name: t.activity.tabs.intervals }).click())
    expect(screen.queryByTestId('run-map')).toBeNull()
    expect(screen.getByTestId('run-map-card').textContent).toContain(t.activity.stats.distance)

    act(() => screen.getByRole('tab', { name: t.activity.tabs.overview }).click())
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  // Under the pinned tabs, the run's numbers on one line, so a tab switch
  // keeps which run this is in view (design review, Oct 2026).
  it('pins a one-line summary under the tabs once they stick, and only then', () => {
    const { rerender } = renderDetail()
    expect(screen.queryByTestId('run-summary')).toBeNull()

    strip.pinned = true
    rerender(<ActivityDetailClient activity={ACTIVITY} aiVerdict={null} dynamicsBaseline={null} />)
    const summary = screen.getByTestId('run-summary')
    expect(summary.closest('[data-testid="sticky-bar"]')).not.toBeNull()
    expect(summary.textContent).toBe(`${formatDistance(6.11)} ${t.units.km}25:244:10 ${t.units.perKm}115 ${t.units.bpm}`)
    // The stats card says it to a screen reader already.
    expect(summary.getAttribute('aria-hidden')).toBe('true')
    // Drawn over what has scrolled under the strip: the page does not move.
    expect(screen.getByTestId('sticky-bar').className).toContain('-mb-9')
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
  it('heads the verdict with a status eyebrow', () => {
    render(<ActivityDetailClient activity={{ ...ACTIVITY, rpe: 7 } as ActivityDetailView} aiVerdict={null} dynamicsBaseline={null} />)

    const eyebrow = screen.getByText(t.activity.verdict.eyebrow.positive)
    expect(eyebrow.getAttribute('style')).toContain('--pos')
  })
})
