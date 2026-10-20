import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecurringRoutes } from '../RecurringRoutes'
import { TRAIL_RUNS } from '../recordsView'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import { t } from '@/i18n'

const geocode = vi.hoisted(() => ({ name: null as string | null }))
vi.mock('@/lib/reverseGeocode', () => ({ reverseGeocode: async () => geocode.name }))

const runs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ activityId: `a${i}`, date: '2026-01-01', paceSecPerKm: 280 + (i % 7) }))

const route = (n: number): RecurringRoute => ({
  id: `r${n}`,
  start: null,
  runCount: n,
  distanceKm: 7.6,
  outline: 'M0 0 L10 10',
  runs: runs(n),
  bestPaceSecPerKm: 280,
  bestActivityId: 'a0',
  bestDate: '2026-01-01',
})

afterEach(() => {
  geocode.name = null
  vi.unstubAllEnvs()
})

describe('RecurringRoutes row', () => {
  // G13: the busiest routes squeezed their own text to "9.…".
  it('caps the trail at the latest runs, one bar each', () => {
    render(<RecurringRoutes routes={[route(60)]} thisYear={2026} />)

    expect(screen.getByTestId('pace-trail').children).toHaveLength(TRAIL_RUNS)
  })

  // Design review, Oct 2026: "7.20 km" sat in the list with "12.9 km".
  it('writes every distance to one decimal, beside the run count', () => {
    render(
      <RecurringRoutes
        routes={[{ ...route(3), distanceKm: 7.2 }, { ...route(4), distanceKm: 12.9 }, { ...route(5), distanceKm: 10 }]}
        thisYear={2026}
      />,
    )

    const lines = screen.getAllByTestId('route-text').map((el) => el.textContent ?? '')
    expect(lines[0]).toContain(`7.2 ${t.units.km} · ${t.records.recurring.runCount(3)}`)
    expect(lines[0]).not.toContain('7.20')
    expect(lines[1]).toContain(`12.9 ${t.units.km}`)
    expect(lines[2]).toContain(`10.0 ${t.units.km}`)
  })

  it('names a route after its start, and numbers it until a place comes back', async () => {
    render(<RecurringRoutes routes={[route(3), route(4)]} thisYear={2026} />)
    expect(screen.getAllByTestId('route-name').map((el) => el.textContent)).toEqual([
      t.records.recurring.unnamed(1),
      t.records.recurring.unnamed(2),
    ])
  })

  it('takes the place name when the lookup returns one', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'test-token')
    geocode.name = 'Rue du Faubourg Saint-Antoine'
    render(<RecurringRoutes routes={[{ ...route(5), start: [6.17, 49.12] }]} thisYear={2026} />)

    expect(await screen.findByText('Rue du Faubourg Saint-Antoine')).toHaveAttribute('data-testid', 'route-name')
  })

  // Final mockups (3.1.0): "best 5:07 · last 5:19 +12s", the gap in amber.
  it('gives the best and the latest, with how far the latest is off it', () => {
    render(<RecurringRoutes routes={[route(5)]} thisYear={2026} />)

    const line = screen.getByTestId('route-best')
    // Five runs at 280-284: the latest at 284, four behind the best.
    expect(line.textContent).toBe(`${t.records.recurring.bestPace('4:40')} · ${t.records.recurring.lastPace('4:44')} +4s`)
    expect(screen.getByTestId('route-gap').className).toContain('var(--warn)')
  })

  it('says "new best" with the date when the latest run is the best', () => {
    const fresh: RecurringRoute = { ...route(4), bestActivityId: 'a3', bestPaceSecPerKm: 283 }
    render(<RecurringRoutes routes={[fresh]} thisYear={2026} />)

    expect(screen.getByTestId('route-best').textContent).toBe(`${t.records.recurring.bestPace('4:43')} · ${t.records.recurring.newBest} Jan 1`)
    expect(screen.queryByTestId('route-gap')).toBeNull()
  })

  it('paints the best bar in the accent and the latest in ink', () => {
    render(<RecurringRoutes routes={[route(5)]} thisYear={2026} />)

    const tones = [...screen.getByTestId('pace-trail').children].map((bar) => bar.getAttribute('data-tone'))
    expect(tones).toEqual(['best', 'other', 'other', 'other', 'latest'])
  })

  // Design review, Oct 2026: "taller = faster" named no axis.
  it('says what a bar is, keys its colours, and dates the trail by its first and latest runs', () => {
    const dates = ['2024-12-01', '2024-12-02', '2025-04-12', ...Array.from({ length: 14 }, (_, i) => `2026-0${1 + (i % 9)}-15`), '2026-10-07']
    const dated: RecurringRoute = {
      ...route(dates.length),
      runs: dates.map((date, i) => ({ activityId: `d${i}`, date, paceSecPerKm: 280 + (i % 5) })),
    }
    const { unmount } = render(<RecurringRoutes routes={[dated]} thisYear={2026} />)

    expect(screen.getByText(t.records.recurring.trailKey)).toBeInTheDocument()
    expect(screen.getByText(t.records.recurring.legendBest)).toBeInTheDocument()
    expect(screen.getByText(t.records.recurring.legendLatest)).toBeInTheDocument()
    // The latest 16 runs: the two of December 2024 are off the trail.
    expect(screen.getByTestId('pace-trail-span').textContent).toBe(t.records.recurring.trailSpan('Apr ’25', 'Oct 7'))
    unmount()

    // Every run on one day: that day, once.
    render(<RecurringRoutes routes={[route(4)]} thisYear={2026} />)
    expect(screen.getByTestId('pace-trail-span').textContent).toBe('Jan 1')
  })
})
