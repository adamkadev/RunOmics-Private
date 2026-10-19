import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LastRun, SessionCard } from '../nextSession'
import { TodayBoard } from '../TodayBoard'

const SESSION: SessionCard = {
  date: '2026-10-19', eyebrow: 'Today · Mon 19', title: 'Long run', km: '12', detail: '1h10',
  workout: null, phase: 'Base', href: '/plan?date=2026-10-19',
}

const YESTERDAY: LastRun = {
  state: 'done', when: 'yesterday', date: '2026-10-18', title: 'Easy',
  detail: '8.0 km · 5:52 /km · 141 bpm · 46:58', href: '/activities/a1', thumb: null, type: 'Base',
}

const TODAY_DONE: LastRun = {
  state: 'done', when: 'today', date: '2026-10-19', title: 'Long run',
  detail: '11.5 km · 5:47 /km · planned 12 km', href: '/activities/a2', thumb: null, type: 'Base',
}

function order(): string[] {
  return [...screen.getByTestId('today-board').children].map((child) => child.getAttribute('data-testid')!)
}

describe('TodayBoard', () => {
  // Before today's run: the session to run, then the run behind it.
  it('puts today’s session over the last run', () => {
    render(<TodayBoard session={SESSION} lastRun={YESTERDAY} />)
    expect(order()).toEqual(['session-card', 'last-run'])
  })

  // After it: what was done, then what comes next.
  it('puts today’s run over the next session once it is done', () => {
    render(<TodayBoard session={{ ...SESSION, eyebrow: 'Tomorrow · Tue 20' }} lastRun={TODAY_DONE} />)
    expect(order()).toEqual(['last-run', 'session-card'])
  })

  it('draws only what it has', () => {
    render(<TodayBoard session={SESSION} lastRun={null} />)
    expect(screen.queryByTestId('last-run')).toBeNull()
    expect(screen.getByTestId('session-card')).toBeInTheDocument()
  })
})
