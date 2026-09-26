import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ActivitySummary } from '@/domain/activity/types'
import { RecentActivities } from '../RecentActivities'

function run(id: string, overrides: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    id, date: '2026-09-24', dayOfWeek: 'Thursday', type: 'Base', description: 'Easy run', comment: '',
    distanceKm: 8.58, durationSeconds: 3066, paceSecPerKm: 355, avgHeartRate: 140, rpe: 2, hrZones: [],
    week: 202639, elevationGain: null, routeThumb: 'M10 10L40 40', ...overrides,
  }
}

describe('RecentActivities', () => {
  // H06, M7: the latest runs as rows in one card, each with its route.
  it('draws each run as a row with its route thumbnail', () => {
    render(<RecentActivities activities={[run('a'), run('b', { routeThumb: null, type: 'Threshold' })]} />)

    const rows = screen.getAllByTestId('thumb-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain('RPE 2')
    expect(rows[0]!.textContent).toContain('8.58')
    const thumbs = screen.getAllByTestId('route-thumb')
    expect(thumbs[0]!.style.width).toBe('56px')
    expect(thumbs[1]!.dataset.neutral).toBe('true')
  })

  it('draws nothing without runs', () => {
    const { container } = render(<RecentActivities activities={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
