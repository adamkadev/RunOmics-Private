import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ActivitySummary } from '@/domain/activity/types'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { t } from '@/i18n'
import { formatWeekday } from '@/lib/formatters'
import { TodayHero } from '../TodayHero'

const RUN: ActivitySummary = {
  id: 'a1', date: '2026-09-24', dayOfWeek: 'Thursday', type: 'Threshold', description: 'Threshold', comment: '',
  distanceKm: 6.11, durationSeconds: 1_528, paceSecPerKm: 250, avgHeartRate: 160, rpe: null, hrZones: [], week: 0, elevationGain: null,
}
const PLAN = { title: 'Threshold', type: 'Threshold' as const, duration: { seconds: 1_500, estimated: false }, distanceM: 6_000, activityId: 'a1', target: null, structure: null }

describe('TodayHero', () => {
  // v4.17: a plain surface card - the verdict's colour is its eyebrow's
  // alone, never a tinted border or fill.
  it('draws on the plain card surface, its tone only in the eyebrow', () => {
    const status = { tsbNow: -32, tsbDelta: -6, ctl: 47, atl: 79, atlDelta: 12, loadTrend: 'maintaining' } as unknown as TrainingStatus
    const { container } = render(<TodayHero status={status} plannedWorkout={PLAN} todayActivity={null} aiVerdict={null} />)
    const card = container.firstElementChild as HTMLElement

    expect(card.className).toContain('bg-card')
    expect(card.className).toContain('border-border')
    expect(card.getAttribute('style')).toBeNull()
    const eyebrow = screen.getByText(t.dashboard.todayHero.eyebrowByTone.hold)
    expect(eyebrow.getAttribute('style')).toContain('var(--warn)')
    expect(eyebrow.querySelector('span[aria-hidden]')).not.toBeNull()
  })

  it('offers the plan from the session row', () => {
    render(<TodayHero status={null} plannedWorkout={PLAN} todayActivity={null} aiVerdict={null} />)

    expect(screen.getByRole('link', { name: t.dashboard.todayHero.openPlan })).toHaveAttribute('href', '/plan')
    expect(screen.getByTestId('session-card')).toHaveTextContent(`${t.sessionState.planned}Threshold`)
  })

  it('names the next session on a rest day', () => {
    const status = { tsbNow: -15, tsbDelta: 7, ctl: 47, atl: 62, atlDelta: 6, loadTrend: 'maintaining' } as unknown as TrainingStatus
    render(
      <TodayHero
        status={status}
        plannedWorkout={null}
        todayActivity={null}
        aiVerdict={null}
        nextSession={{ date: '2026-09-29', title: 'Threshold 3 x 7:15', km: '10', inDays: 1, kind: 'threshold' }}
      />,
    )

    const row = screen.getByTestId('session-card')
    expect(row).toHaveTextContent(t.dashboard.todayHero.restDay)
    expect(row).toHaveTextContent(t.dashboard.todayHero.next(formatWeekday('2026-09-29'), 'Threshold 3 x 7:15', '10'))
  })

  // v4.3.4: the watch status left the head for the Body card.
  it('keeps the watch status out of the head and reads the coach sentence under the headline', () => {
    render(
      <TodayHero status={null} plannedWorkout={PLAN} todayActivity={null} aiVerdict={{ headline: 'Steady day.', body: 'Keep it moderate.' }} />,
    )

    expect(screen.queryByText(t.trainingStatus.status.productive)).toBeNull()
    expect(screen.getByText('Steady day.')).toBeInTheDocument()
    expect(screen.getByTestId('today-body').textContent).toBe('Keep it moderate.')
    expect(screen.queryByText(t.sessionCard.coachInsight)).toBeNull()
  })

  // The footer showed a finished run's "6.11 km · 25 min" with no state, so it
  // read like the session still to do.
  it('leads the session row with its state and planned against ran', () => {
    render(
      <TodayHero
        status={null}
        plannedWorkout={PLAN}
        todayActivity={RUN}
        aiVerdict={{ headline: 'Steady day.', body: 'Keep it moderate.' }}
      />,
    )

    const row = screen.getByTestId('session-card')
    expect(row).toHaveTextContent(`✓ ${t.sessionState.done}`)
    expect(row).toHaveTextContent('Threshold')
    expect(row).toHaveTextContent(`${t.sessionCard.ranAt('6.11', '4:10 /km')} · ${t.sessionCard.plannedKm('6')}`)
    expect(row.getAttribute('href')).toBe('/activities/a1')
  })

  it('keeps the offline copy when the AI insight is missing', () => {
    const status = { tsbNow: 2, tsbDelta: 1, ctl: 40, atl: 38, loadTrend: 'maintaining' } as unknown as TrainingStatus
    render(<TodayHero status={status} plannedWorkout={null} todayActivity={null} aiVerdict={null} />)

    expect(screen.queryByText(t.sessionCard.coachInsight)).not.toBeInTheDocument()
    expect(screen.getByTestId('session-card')).toHaveTextContent(t.dashboard.todayHero.restDay)
  })

  // The race is the plan's reason, not a daily number: its countdown stays on
  // Plan and Goals.
  it('carries no race countdown', () => {
    const { container } = render(<TodayHero status={null} plannedWorkout={PLAN} todayActivity={null} aiVerdict={null} />)

    expect(container.textContent).not.toMatch(/D-\d+/)
  })
})

describe('the line under the verdict', () => {
  it('is the coach sentence when there is one, in place of the form line', () => {
    const status = { tsbNow: -24, tsbDelta: -10, ctl: 48, atl: 73, loadTrend: 'maintaining' } as unknown as TrainingStatus
    render(<TodayHero status={status} plannedWorkout={null} todayActivity={null} aiVerdict={{ headline: 'Solid 13 km banked', body: 'Rest and eat well.' } as never} />)
    expect(screen.getByTestId('today-body').textContent).toBe('Rest and eat well.')
    expect(screen.queryByTestId('today-reason')).toBeNull()
  })

  // v4.17.1: never the Form / Fitness / Fatigue row again, under a headline
  // that already said it.
  it('falls back to why and what it gives, with no figure from the stats row', () => {
    const status = { tsbNow: -11, tsbDelta: -3, ctl: 45, atl: 56, loadTrend: 'maintaining' } as unknown as TrainingStatus
    render(<TodayHero status={status} plannedWorkout={null} todayActivity={null} aiVerdict={{ headline: "Keep today's long run easy", body: '' } as never} yesterday="long_run" />)
    const v = t.dashboard.todayHero.verdict
    expect(screen.getByTestId('today-reason').textContent).toBe(`${v.yesterdayInLegs(v.kind.long_run)} ${v.gain.restSinksIn}`)
    expect(screen.getByTestId('today-reason').textContent).not.toMatch(/\d/)
  })
})

describe('the verdict without a written one (v4.17.1)', () => {
  const tired = { tsbNow: -32, tsbDelta: -6, ctl: 47, atl: 79, atlDelta: 12, loadTrend: 'maintaining' } as unknown as TrainingStatus

  it("reads a rest day after a long run as the prototype does: rest now, for Tuesday's threshold", () => {
    render(
      <TodayHero
        status={tired}
        plannedWorkout={null}
        todayActivity={null}
        aiVerdict={null}
        yesterday="long_run"
        nextSession={{ date: '2026-09-29', title: 'Threshold 3 x 7:15', km: '10', inDays: 1, kind: 'threshold' }}
      />,
    )
    const v = t.dashboard.todayHero.verdict
    expect(screen.getByText(v.headline.rest.hold)).toBeInTheDocument()
    expect(screen.getByTestId('today-reason').textContent).toBe(`${v.yesterdayInLegs(v.kind.long_run)} ${v.gain.restPaysOff(v.tomorrow, v.kind.threshold)}`)
    // Nothing the stats row prints: no form, fitness or fatigue figure.
    expect(screen.getByTestId('today-hero').querySelector('[data-testid="today-reason"]')!.textContent).not.toMatch(/\d/)
  })
})
