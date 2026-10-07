import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecurringRoutes, TRAIL_RUNS } from '../RecurringRoutes'
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
  it('keeps the text column fixed and caps the trail at the latest runs', () => {
    render(<RecurringRoutes routes={[route(60)]} thisYear={2026} />)

    expect(screen.getByTestId('route-text').className).toContain('w-[150px]')
    expect(screen.getByTestId('route-text').className).toContain('shrink-0')
    const trail = screen.getByTestId('pace-trail')
    expect(trail.children).toHaveLength(TRAIL_RUNS)
    // The trail and the dates under it take what the text leaves.
    expect(trail.parentElement!.className).toContain('flex-1')
  })

  // Design review, Oct 2026: "7.20 km" sat in the list with "12.9 km".
  it('writes every distance to one decimal', () => {
    render(
      <RecurringRoutes
        routes={[{ ...route(3), distanceKm: 7.2 }, { ...route(4), distanceKm: 12.9 }, { ...route(5), distanceKm: 10 }]}
        thisYear={2026}
      />,
    )

    const lines = screen.getAllByTestId('route-text').map((el) => el.textContent ?? '')
    expect(lines[0]).toContain(`7.2 ${t.units.km}`)
    expect(lines[0]).not.toContain('7.20')
    expect(lines[1]).toContain(`12.9 ${t.units.km}`)
    expect(lines[2]).toContain(`10.0 ${t.units.km}`)
  })

  // Design review, Oct 2026: a street name ahead of the pace cut the date off.
  it('keeps the best run whole on its own line, and puts the place under it', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'test-token')
    geocode.name = 'Rue du Faubourg Saint-Antoine'
    render(<RecurringRoutes routes={[{ ...route(5), start: [6.17, 49.12], bestDate: '2025-03-03' }]} thisYear={2026} />)

    const best = screen.getByTestId('route-best')
    expect(best.className).not.toContain('truncate')
    expect(best.className).toContain('hit-44')
    expect(best.textContent).toBe('4:40 /km · Mar ’25')
    const place = await screen.findByTestId('route-place')
    expect(place.textContent).toBe('Rue du Faubourg Saint-Antoine')
    expect(place.className).not.toContain('truncate')
    expect(best.contains(place)).toBe(false)
  })

  // Design review, Oct 2026: "taller = faster" named no axis.
  it('says what a bar is, and dates the trail by its first and latest runs', () => {
    const dates = ['2024-12-01', '2024-12-02', '2025-04-12', ...Array.from({ length: 22 }, (_, i) => `2026-0${1 + (i % 9)}-15`), '2026-10-07']
    const dated: RecurringRoute = {
      ...route(dates.length),
      runs: dates.map((date, i) => ({ activityId: `d${i}`, date, paceSecPerKm: 280 + (i % 5) })),
    }
    const { unmount } = render(<RecurringRoutes routes={[dated]} thisYear={2026} />)

    expect(screen.getByText(t.records.recurring.trailKey)).toBeInTheDocument()
    // The latest 24 runs: the two of December 2024 are off the trail.
    expect(screen.getByTestId('pace-trail-span').textContent).toBe(t.records.recurring.trailSpan('Apr ’25', 'Oct 7'))
    unmount()

    // Every run on one day: that day, once.
    render(<RecurringRoutes routes={[route(4)]} thisYear={2026} />)
    expect(screen.getByTestId('pace-trail-span').textContent).toBe('Jan 1')
  })
})
