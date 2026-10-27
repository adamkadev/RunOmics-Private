import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReturnProgress } from '@/application/usecases/GetReturnProgress'
import { ReturnProgressView } from '../ReturnProgressView'
import { ReturnProgressCard } from '@/components/plan/ReturnProgressCard'

const progress: ReturnProgress = {
  breakStart: '2026-03-01',
  breakEnd: '2026-10-05',
  milestones: [
    { key: 'continuous10', date: '2026-10-12', activityId: 'r1' },
    { key: 'blockCompleted', date: '2026-10-26', activityId: null },
  ],
  pending: ['continuous20', 'continuous30', 'nonstop3k', 'nonstop5k'],
  longestSec: 780,
  weeks: [
    { weekStart: '2026-10-05', runningSec: 1800, longestSec: 420 },
    { weekStart: '2026-10-12', runningSec: 0, longestSec: 0 },
    { weekStart: '2026-10-19', runningSec: 2700, longestSec: 780 },
  ],
  ongoing: true,
}

describe('ReturnProgressView', () => {
  it('lists the milestones reached, linked to their run, then those ahead', () => {
    render(<ReturnProgressView progress={progress} today="2026-10-27" />)

    const reached = screen.getAllByTestId('return-milestone')
    expect(reached.map((row) => row.textContent)).toEqual([expect.stringContaining('First 10 minutes non-stop'), expect.stringContaining('First block completed')])
    expect(screen.getByRole('link', { name: /First 10 minutes/ })).toHaveAttribute('href', '/activities/r1')
    expect(screen.getAllByTestId('return-pending')).toHaveLength(4)
    expect(screen.getByTestId('return-longest')).toHaveTextContent('13')
  })
})

describe('ReturnProgressCard', () => {
  it('draws a bar per week, each named with its minutes, and this week’s total', () => {
    render(<ReturnProgressCard progress={progress} today="2026-10-27" />)

    const weeks = screen.getAllByTestId('return-week')
    expect(weeks).toHaveLength(3)
    expect(weeks[2]).toHaveAttribute('aria-label', expect.stringContaining('45 min'))
    expect(screen.getByTestId('return-progress-card')).toHaveTextContent('45 min')
  })
})
