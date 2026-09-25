import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActivityDetailView } from '../activityViews'
import { t } from '@/i18n'

vi.mock('../ActivityMapClient', () => ({ ActivityMapClient: () => <div data-testid="map" /> }))
vi.mock('@/lib/firebaseConfig', () => ({ isClientFirebaseConfigured: false }))
vi.mock('@/lib/useOwnerAuth', () => ({ useOwnerAuth: () => ({ isOwner: false }) }))

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
      shoe={null}
      dynamicsBaseline={null}
      plan={{ title: 'Threshold', type: 'Threshold', distanceM: 6_000, durationSeconds: 1_500 }}
    />,
  )
}

describe('ActivityDetailClient', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  // Similar runs and the map filled the first screen; the run's own stats,
  // RPE and note were on the second or on none.
  it('orders the run first: stats, verdict with plan, effort and note, then tabs', () => {
    const { container } = renderDetail()
    const text = container.textContent ?? ''
    const at = (s: string) => text.indexOf(s)

    expect(at(t.activity.stats.distance)).toBeLessThan(at(t.activity.verdict.title))
    expect(at(t.activity.verdict.title)).toBeLessThan(at(t.sessionCard.onPlan))
    expect(at(t.sessionCard.onPlan)).toBeLessThan(at(t.activity.effort.label))
    expect(at(t.activity.effort.label)).toBeLessThan(at(t.activity.noteRow.label))
    expect(at(t.activity.noteRow.label)).toBeLessThan(at(t.activity.tabs.overview))
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
})
