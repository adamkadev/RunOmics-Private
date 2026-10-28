import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReturnProgress } from '@/application/usecases/GetReturnProgress'
import { ReturnProgressView } from '../ReturnProgressView'
import { ReturnProgressCard } from '@/components/plan/ReturnProgressCard'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'

const NOW = new Date('2026-10-27T12:00:00')

const progress: ReturnProgress = {
  breakStart: '2026-03-01',
  breakEnd: '2026-10-05',
  firstDayBack: '2026-10-06',
  runsSince: 4,
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

const beforeFirstRun: ReturnProgress = {
  ...progress,
  runsSince: 0,
  milestones: [],
  pending: ['continuous10', 'continuous20', 'continuous30', 'nonstop3k', 'nonstop5k', 'blockCompleted'],
  longestSec: 0,
  weeks: [{ weekStart: '2026-10-05', runningSec: 0, longestSec: 0 }],
}

describe('the return date', () => {
  it('is the day after the break’s last day, in the card and the view', () => {
    render(<ReturnProgressCard progress={progress} today="2026-10-27" />)
    render(<ReturnProgressView progress={progress} today="2026-10-27" />)

    expect(screen.getAllByText(t.returnProgress.since(formatDate('2026-10-06', { now: NOW })))).toHaveLength(2)
    expect(screen.queryByText(t.returnProgress.since(formatDate('2026-10-05', { now: NOW })))).toBeNull()
  })
})

describe('before the first run back', () => {
  it('the card says only that no run came yet', () => {
    render(<ReturnProgressCard progress={beforeFirstRun} today="2026-10-08" />)

    const card = screen.getByTestId('return-progress-card')
    expect(screen.getByTestId('return-card-nothing-yet')).toHaveTextContent(t.returnProgress.nothingYet)
    expect(screen.queryByTestId('return-week')).toBeNull()
    expect(screen.queryByTestId('return-card-longest')).toBeNull()
    expect(card).not.toHaveTextContent('—')
    expect(card).not.toHaveTextContent(t.returnProgress.minutes(0))
  })

  it('the view says so in place of the longest run, and keeps the milestones ahead', () => {
    render(<ReturnProgressView progress={beforeFirstRun} today="2026-10-08" />)

    expect(screen.getByTestId('return-nothing-yet')).toHaveTextContent(t.returnProgress.nothingYet)
    expect(screen.queryByTestId('return-longest')).toBeNull()
    expect(screen.getAllByTestId('return-pending')).toHaveLength(6)
  })
})

describe('a week without a run yet', () => {
  it('leaves this week’s minutes out of the card and keeps its bar', () => {
    const progressNoRunThisWeek = { ...progress, weeks: [...progress.weeks, { weekStart: '2026-10-26', runningSec: 0, longestSec: 0 }] }
    render(<ReturnProgressCard progress={progressNoRunThisWeek} today="2026-10-27" />)

    expect(screen.queryByTestId('return-card-this-week')).toBeNull()
    expect(screen.getAllByTestId('return-week')).toHaveLength(4)
  })
})
