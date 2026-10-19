import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LastRun } from '../nextSession'
import type { SessionCardData } from '../TodayBoard'
import { TodayBoard } from '../TodayBoard'
import { t } from '@/i18n'

const SESSION: SessionCardData = {
  eyebrow: t.dashboard.todayHero.tileToday('Long run'),
  title: 'Long run 12 km',
  workout: null,
  hrCapBpm: null,
}

const YESTERDAY: LastRun = {
  state: 'done', layout: 'past', date: '2026-10-18', title: 'Yesterday · Easy',
  detail: '8.0 km · 5:52 /km · 141 bpm · 46:58', href: '/activities/a1', thumb: null, type: 'Base',
}

const TODAY_DONE: LastRun = {
  state: 'done', layout: 'done', date: '2026-10-19', title: 'Long run · Done',
  detail: '11.5 km · 5:47 /km · planned 12 km', href: '/activities/a2',
}

function order(): string[] {
  return [...screen.getByTestId('today-board').children].map((child) => child.getAttribute('data-testid') ?? child.querySelector('[data-testid]')!.getAttribute('data-testid')!)
}

describe('TodayBoard', () => {
  // Before today's run: the session to run, then the run behind it.
  it('puts today’s session over the last run', () => {
    render(<TodayBoard session={SESSION} lastRun={YESTERDAY} />)
    expect(order()).toEqual(['session-card-link', 'last-run'])
  })

  // After it: what was done, then what comes next.
  it('puts today’s run over the next session once it is done', () => {
    render(<TodayBoard session={{ ...SESSION, eyebrow: t.dashboard.todayHero.tileNext('Tue, Oct 20') }} lastRun={TODAY_DONE} />)
    expect(order()).toEqual(['last-run', 'session-card-link'])
  })

  it('leads a past run with its route and a done run with its check', () => {
    const { unmount } = render(<TodayBoard session={null} lastRun={YESTERDAY} />)
    expect(screen.getByTestId('route-thumb')).toBeInTheDocument()
    expect(screen.getByTestId('last-run').dataset.layout).toBe('past')
    unmount()

    render(<TodayBoard session={null} lastRun={TODAY_DONE} />)
    expect(screen.queryByTestId('route-thumb')).toBeNull()
    expect(screen.getByTestId('last-run')).toHaveAttribute('href', '/activities/a2')
  })

  it('draws only what it has', () => {
    render(<TodayBoard session={SESSION} lastRun={null} />)
    expect(screen.queryByTestId('last-run')).toBeNull()
    expect(screen.getByTestId('session-card')).toBeInTheDocument()
  })
})
