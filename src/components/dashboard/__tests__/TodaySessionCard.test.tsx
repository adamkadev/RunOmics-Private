import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { t } from '@/i18n'
import { TodaySessionCard } from '../TodaySessionCard'
import { LastRunRow } from '../LastRunRow'
import type { SessionCard } from '../nextSession'

const STRIDES = [
  { kind: 'effort' as const, minutes: 54, seconds: 3_213 },
  ...Array.from({ length: 6 }, (_, i) => [
    { kind: 'effort' as const, minutes: 1, seconds: 20, rep: i + 1 },
    { kind: 'recovery' as const, minutes: 1, seconds: 60, rep: i + 1 },
  ]).flat(),
]
const EASY: HeroWorkoutView = { title: 'Easy run', type: 'Base', duration: { seconds: 3_600, estimated: false }, distanceM: 10_000, activityId: null, target: null, structure: null, hr: null }

function card(overrides: Partial<SessionCard> = {}): SessionCard {
  return { date: '2026-10-20', eyebrow: 'Tomorrow · Tue 20', title: 'Easy run', km: '10', detail: '1h00 · ≤ 158 bpm', workout: EASY, phase: 'Base', href: '/plan?date=2026-10-20', ...overrides }
}

// Design review 3.0 (mock 1b): the next workout opens Plan on its day.
describe('TodaySessionCard', () => {
  it('is one link to Plan with the day selected, and nothing to send to a watch', () => {
    render(<TodaySessionCard card={card()} />)

    const link = screen.getByTestId('session-card')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/plan?date=2026-10-20')
    expect(link).toHaveTextContent('Tomorrow · Tue 20')
    expect(link).toHaveTextContent('Base')
    expect(screen.getByTestId('session-detail').textContent).toBe(`10 ${t.units.km} · 1h00 · ≤ 158 bpm`)
    expect(link).toHaveTextContent(t.dashboard.todayHero.openInPlan)
    expect(link.textContent).not.toMatch(/watch/i)
    expect(link.querySelector('button')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('heads the card with the day in the accent', () => {
    render(<TodaySessionCard card={card()} />)
    const eyebrow = screen.getByText('Tomorrow · Tue 20')
    expect(eyebrow.className).toContain('text-accent-text')
    expect(eyebrow.className).toContain('uppercase')
  })

  it('draws the bar only for a session built of steps', () => {
    const { unmount } = render(<TodaySessionCard card={card({ workout: { ...EASY, structure: STRIDES } })} />)
    expect(screen.getByTestId('today-structure-bar').children).toHaveLength(7)
    unmount()

    render(<TodaySessionCard card={card()} />)
    expect(screen.queryByTestId('today-structure-bar')).toBeNull()
  })

  it('keeps an older, longer name to two lines', () => {
    render(<TodaySessionCard card={card({ title: "Répétitions allure d'objectif - 4x3'@4:24" })} />)
    expect(screen.getByText("Répétitions allure d'objectif - 4x3'@4:24").className).toContain('line-clamp-2')
  })
})

describe('LastRunRow', () => {
  it('shows a run done with its route, the day, and an accent check', () => {
    render(
      <LastRunRow
        run={{ state: 'done', when: 'yesterday', date: '2026-10-18', title: 'Long run', detail: '11.5 km · 5:47 /km · 145 bpm · 1:06:39', href: '/activities/a1', thumb: 'M10 10L40 40', type: 'Base' }}
      />,
    )

    const row = screen.getByTestId('last-run')
    expect(row).toHaveAttribute('href', '/activities/a1')
    expect(row).toHaveTextContent(t.dashboard.todayHero.yesterday)
    expect(row).toHaveTextContent('Long run')
    expect(row).toHaveTextContent('11.5 km · 5:47 /km · 145 bpm')
    expect(screen.getByTestId('route-thumb')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: t.dashboard.todayHero.done }).style.color).toBe('var(--accent-text)')
  })

  // Shape and colour both, never colour alone; it opens the plan on its day.
  it('shows a session nobody ran as a dashed cross', () => {
    render(
      <LastRunRow
        run={{ state: 'missed', when: 'yesterday', date: '2026-10-18', title: 'Easy run', detail: t.dashboard.todayHero.notRun('10'), href: '/plan?date=2026-10-18', type: 'Base' }}
      />,
    )

    const cross = screen.getByRole('img', { name: t.dashboard.todayHero.notRun(null) })
    expect(cross.textContent).toBe('✕')
    expect(cross.style.border).toContain('dashed')
    expect(screen.getByTestId('last-run')).toHaveTextContent(t.dashboard.todayHero.notRun('10'))
    expect(screen.getByTestId('last-run')).toHaveAttribute('href', '/plan?date=2026-10-18')
    expect(screen.queryByTestId('route-thumb')).toBeNull()
  })
})
