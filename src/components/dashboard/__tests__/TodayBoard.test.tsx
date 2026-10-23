import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SessionCard } from '../nextSession'
import { TodayBoard } from '../TodayBoard'

const SESSION: SessionCard = {
  date: '2026-10-19', eyebrow: 'Today · Mon 19', title: 'Long run', km: '12', detail: '1:10 h',
  workout: null, phase: 'Base', href: '/plan?date=2026-10-19',
}

describe('TodayBoard', () => {
  // The last run is the top of Activities.
  it('draws the next session and no last-run row', () => {
    render(<TodayBoard session={SESSION} />)
    expect([...screen.getByTestId('today-board').children].map((child) => child.getAttribute('data-testid'))).toEqual(['session-card'])
    expect(screen.queryByTestId('last-run')).toBeNull()
  })

  it('draws nothing in a week with nothing left', () => {
    render(<TodayBoard session={null} />)
    expect(screen.getByTestId('today-board').children).toHaveLength(0)
  })
})
