import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecurringRoutes, TRAIL_RUNS } from '../RecurringRoutes'
import type { RecurringRoute } from '@/application/usecases/GetRecurringRoutes'

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

describe('RecurringRoutes row', () => {
  // G13: the busiest routes squeezed their own text to "9.…".
  it('keeps the text column fixed and caps the trail at the latest runs', () => {
    render(<RecurringRoutes routes={[route(60)]} thisYear={2026} />)

    expect(screen.getByTestId('route-text').className).toContain('w-[150px]')
    expect(screen.getByTestId('route-text').className).toContain('shrink-0')
    const trail = screen.getByTestId('pace-trail')
    expect(trail.children).toHaveLength(TRAIL_RUNS)
    expect(trail.className).toContain('flex-1')
  })
})
