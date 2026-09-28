import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ActivitySummary } from '@/domain/activity/types'
import { t } from '@/i18n'
import { formatDate } from '@/lib/formatters'
import { RecentActivities } from '../RecentActivities'

function run(id: string, overrides: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    id, date: '2026-09-24', dayOfWeek: 'Thursday', type: 'Base', description: 'Easy run', comment: '',
    distanceKm: 8.58, durationSeconds: 3066, paceSecPerKm: 355, avgHeartRate: 140, rpe: 2, hrZones: [],
    week: 202639, elevationGain: null, routeThumb: 'M10 10L40 40', ...overrides,
  }
}

describe('RecentActivities', () => {
  // H06, v4.17: the latest runs as list rows in one card, each with its
  // route, a meta line (dot, date, type, RPE) and the pace per km.
  it('draws each run as a list row with its route thumbnail', () => {
    render(<RecentActivities activities={[run('a'), run('b', { routeThumb: null, type: 'Threshold' })]} />)

    const rows = screen.getAllByTestId('thumb-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain(`${formatDate('2026-09-24')} · ${t.activityTypes.Base} · RPE 2`)
    expect(rows[0]!.textContent).toContain('8.58')
    expect(rows[0]!.textContent).toContain('5:55 /km')
    expect(rows[1]!.textContent).toContain(t.activityTypes.Threshold)
    const thumbs = screen.getAllByTestId('route-thumb')
    expect(thumbs[0]!.style.width).toBe('52px')
    expect(thumbs[1]!.dataset.neutral).toBe('true')
  })

  it('draws nothing without runs', () => {
    const { container } = render(<RecentActivities activities={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
