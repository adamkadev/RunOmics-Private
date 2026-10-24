import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { RecurringRoutes } from '../RecurringRoutes'
import { routeKey } from '@/lib/routeNames'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'
import { t } from '@/i18n'

const geocode = vi.hoisted(() => ({ name: null as string | null }))
vi.mock('@/lib/reverseGeocode', () => ({ reverseGeocode: async () => geocode.name }))
const saved = vi.hoisted(() => ({ names: new Map<string, string>() }))
vi.mock('@/lib/routeNames', async (actual) => ({ ...(await actual<typeof import('@/lib/routeNames')>()), readRouteNames: async () => saved.names }))

const runs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ activityId: `a${i}`, date: '2026-01-01', paceSecPerKm: 280 + (i % 7) }))

const route = (n: number): RecurringRoute => ({
  id: `r${n}`,
  start: null,
  far: null,
  shape: 'loop',
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
  it('outlines the latest bar under the white accent, and fills it under every other', () => {
    const latest = () => [...screen.getByTestId('pace-trail').children].find((bar) => bar.getAttribute('data-tone') === 'latest')!

    render(<RecurringRoutes routes={[route(6)]} thisYear={2026} />)
    expect(latest().className).toContain('bg-foreground')

    act(() => {
      localStorage.setItem('runomics-accent', 'mono')
      window.dispatchEvent(new Event('runomics:accent-change'))
    })
    expect(latest().className).toContain('bg-transparent')
    expect(latest().className).toContain('border-foreground')
    localStorage.removeItem('runomics-accent')
  })

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

  it('numbers a route until a place comes back', async () => {
    render(<RecurringRoutes routes={[route(3), route(4)]} thisYear={2026} />)
    expect(screen.getAllByTestId('route-name').map((el) => el.textContent)).toEqual([
      t.records.recurring.unnamed(1),
      t.records.recurring.unnamed(2),
    ])
  })

  it('names a route after the place at its far point', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_TOKEN', 'test-token')
    geocode.name = 'Moselle riverside'
    render(<RecurringRoutes routes={[{ ...route(5), start: [6.17, 49.12], far: [6.18, 49.13], shape: 'loop' }]} thisYear={2026} />)

    expect(await screen.findByText(t.records.recurring.named.loop('Moselle riverside'))).toHaveAttribute('data-testid', 'route-name')
  })

  it('keeps a name the athlete gave the route', async () => {
    const named = { ...route(5), start: [6.17, 49.12] as [number, number], far: [6.18, 49.13] as [number, number] }
    saved.names = new Map([[routeKey(named)!, 'Home loop']])
    render(<RecurringRoutes routes={[named]} thisYear={2026} />)
    expect(await screen.findByText('Home loop')).toHaveAttribute('data-testid', 'route-name')
    saved.names = new Map()
  })

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

  it('says what a bar is, keys its colours, and shows the last six runs with no dates', () => {
    render(<RecurringRoutes routes={[route(20)]} thisYear={2026} />)

    expect(screen.getByText(t.records.recurring.trailKey)).toBeInTheDocument()
    expect(screen.getByText(t.records.recurring.legendBest)).toBeInTheDocument()
    expect(screen.getByText(t.records.recurring.legendLatest)).toBeInTheDocument()
    expect(screen.getByTestId('pace-trail').children).toHaveLength(6)
    expect(screen.queryByTestId('pace-trail-span')).toBeNull()
  })
})
