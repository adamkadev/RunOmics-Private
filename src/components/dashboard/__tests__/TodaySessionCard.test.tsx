import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
import { t } from '@/i18n'
import { TodaySessionCard } from '../TodaySessionCard'

const LONG_RUN: HeroWorkoutView = {
  title: 'Long run 12 km',
  type: 'Base',
  duration: { seconds: 4_200, estimated: false },
  distanceM: 12_000,
  target: null,
  activityId: null,
  structure: [{ kind: 'effort', minutes: 70, paceSecPerKm: [330, 384] }],
  hr: { capBpm: 152, zone: 2 },
}

describe('TodaySessionCard', () => {
  it('heads the card with the day and the session kind, in the accent', () => {
    render(<TodaySessionCard eyebrow={t.dashboard.todayHero.tileToday('Long run')} title="Long run 12 km" workout={LONG_RUN} hrCapBpm={152} />)
    const eyebrow = screen.getByText(t.dashboard.todayHero.tileToday('Long run'))

    expect(eyebrow.className).toContain('text-accent-text')
    expect(eyebrow.className).toContain('uppercase')
    expect(screen.getByTestId('session-card')).toHaveTextContent('Long run 12 km')
  })

  it('lines up time, distance, pace and the HR cap', () => {
    render(<TodaySessionCard eyebrow="Today" title="Long run 12 km" workout={LONG_RUN} hrCapBpm={152} />)
    const fields = screen.getByTestId('session-fields')

    expect(fields).toHaveTextContent(`${t.dashboard.todayHero.fields.time}1:10`)
    expect(fields).toHaveTextContent(`${t.dashboard.todayHero.fields.dist}12.0`)
    expect(fields).toHaveTextContent(`${t.dashboard.todayHero.fields.pace}5:30–6:24`)
    expect(fields).toHaveTextContent(`${t.dashboard.todayHero.fields.hr}${t.dashboard.todayHero.hrCap(152)}`)
  })

  it('drops the HR field when the session has no HR target', () => {
    render(<TodaySessionCard eyebrow="Today" title="Long run 12 km" workout={{ ...LONG_RUN, hr: null }} hrCapBpm={null} />)
    expect(screen.getByTestId('session-fields')).not.toHaveTextContent(t.dashboard.todayHero.fields.hr)
  })

  // Design review, Oct 2026: no coach note, no "Open plan" button - the card is the link.
  it('is itself the link to the plan, with no button inside it', () => {
    render(<TodaySessionCard eyebrow="Today" title="Long run 12 km" workout={LONG_RUN} hrCapBpm={152} />)

    expect(screen.getByRole('link', { name: t.dashboard.todayHero.openSession })).toHaveAttribute('href', '/plan')
    expect(screen.getByTestId('session-card').querySelector('button')).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('draws the session’s shape under its fields', () => {
    render(<TodaySessionCard eyebrow="Today" title="Long run 12 km" workout={LONG_RUN} hrCapBpm={152} />)
    expect(screen.getByTestId('today-structure-bar')).toHaveTextContent(`Z2 ${t.plan.continuous}`)
  })

  it('writes a session under an hour in minutes', () => {
    render(
      <TodaySessionCard
        eyebrow="Today"
        title="Easy run"
        workout={{ ...LONG_RUN, duration: { seconds: 3_480, estimated: false } }}
        hrCapBpm={null}
      />,
    )
    expect(screen.getByTestId('session-fields')).toHaveTextContent(`${t.dashboard.todayHero.fields.time}58 ${t.units.min}`)
  })
})
