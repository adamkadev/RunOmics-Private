import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ActivitySummary } from '@/domain/activity/types'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { t } from '@/i18n'
import { formatDate } from '@/lib/formatters'
import type { HeroWorkoutView } from '@/components/plan/planWorkoutView'
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

  // Oct 7: Form -18 with the load in range read amber "Caution", then green
  // above a Form card that said "Tired". A normal day of a block is neither.
  it('reads a normal day of a block as building, in neutral ink', () => {
    const status = { status: 'productive', risk: 'low', tsbNow: -18, tsbDelta: 3, ctl: 54, atl: 71, atlDelta: -1, loadTrend: 'building' } as unknown as TrainingStatus
    render(<TodayHero status={status} plannedWorkout={PLAN} todayActivity={null} aiVerdict={null} />)

    const eyebrow = screen.getByText(t.dashboard.todayHero.eyebrowByTone.build)
    expect(eyebrow.getAttribute('style')).toContain('var(--text-2)')
    expect(eyebrow.getAttribute('style')).not.toContain('var(--warn)')
  })

  // Design review, Oct 2026: today's session until it is run, in a tile that
  // says when, what and how, with the plan a 44 pt tap away.
  it("shows today's session in the tile until it is run, and offers the plan", () => {
    render(<TodayHero status={null} plannedWorkout={PLAN} todayActivity={null} aiVerdict={null} today="2026-09-24" />)

    const open = screen.getByRole('link', { name: t.dashboard.todayHero.openPlan })
    expect(open).toHaveAttribute('href', '/plan')
    expect(open.className).toContain('hit-44')
    const tile = screen.getByTestId('session-tile')
    expect(tile).toHaveTextContent(t.dashboard.todayHero.tileToday(formatDate('2026-09-24')))
    expect(tile).toHaveTextContent('Threshold')
    expect(screen.queryByTestId('last-run')).toBeNull()
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

    const tile = screen.getByTestId('session-tile')
    expect(tile).toHaveTextContent(t.dashboard.todayHero.tileNext(formatDate('2026-09-29')))
    expect(tile).toHaveTextContent('Threshold 3 x 7:15')
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
  // read like the session still to do. Done is a check row that opens the run,
  // and the tile moves on to the next session.
  it('shows a run done as a checked row over the next session', () => {
    render(
      <TodayHero
        status={null}
        plannedWorkout={PLAN}
        todayActivity={RUN}
        aiVerdict={{ headline: 'Steady day.', body: 'Keep it moderate.' }}
        lastRun={{ state: 'done', date: '2026-09-24', title: 'Threshold · Done', detail: `${t.sessionCard.ranAt('6.11', '4:10 /km')} · ${t.sessionCard.plannedKm('6')}`, href: '/activities/a1' }}
        nextSession={{ date: '2026-09-26', title: 'Easy run', km: '9', inDays: 2, kind: 'easy' }}
      />,
    )

    const row = screen.getByTestId('last-run')
    expect(row.dataset.state).toBe('done')
    expect(row).toHaveTextContent('Threshold · Done')
    expect(row.getAttribute('href')).toBe('/activities/a1')
    expect(screen.getByTestId('session-tile')).toHaveTextContent(t.dashboard.todayHero.tileNext(formatDate('2026-09-26')))
  })

  // A missed session is shape and colour both, and opens the plan read-only.
  it('shows a session nobody ran as a dashed cross, never colour alone', () => {
    render(
      <TodayHero
        status={null}
        plannedWorkout={PLAN}
        todayActivity={null}
        aiVerdict={{ headline: 'Steady day.', body: '' }}
        lastRun={{ state: 'missed', date: '2026-09-24', title: 'Thu · Easy run', detail: t.dashboard.todayHero.notRun('10'), href: '/plan' }}
      />,
    )

    const row = screen.getByTestId('last-run')
    expect(row.textContent).toContain('✕')
    expect(row.querySelector<HTMLElement>('[aria-hidden]')!.style.border).toContain('dashed')
    expect(row).toHaveTextContent(t.dashboard.todayHero.notRun('10'))
    expect(row.getAttribute('href')).toBe('/plan')
  })

  it('keeps the offline copy when the AI insight is missing', () => {
    const status = { tsbNow: 2, tsbDelta: 1, ctl: 40, atl: 38, loadTrend: 'maintaining' } as unknown as TrainingStatus
    render(<TodayHero status={status} plannedWorkout={null} todayActivity={null} aiVerdict={null} />)

    expect(screen.queryByText(t.sessionCard.coachInsight)).not.toBeInTheDocument()
    expect(screen.getByTestId('session-tile')).toHaveTextContent(t.dashboard.todayHero.restDay)
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
    const status = { tsbNow: -22, tsbDelta: -3, ctl: 45, atl: 67, atlDelta: -1, loadTrend: 'maintaining' } as unknown as TrainingStatus
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

// Design review, Oct 2026 (mock 1a): the tile shows the session's shape - a
// 12 pt bar and its caption - and a name too long for its row in two lines.
describe('the session tile', () => {
  const STRIDES = [
    { kind: 'effort' as const, minutes: 54, seconds: 3_213 },
    ...Array.from({ length: 6 }, (_, i) => [
      { kind: 'effort' as const, minutes: 1, seconds: 20, rep: i + 1 },
      { kind: 'recovery' as const, minutes: 1, seconds: 60, rep: i + 1 },
    ]).flat(),
  ]
  // A rest day, so the tile is the next session.
  const status = { status: 'productive', risk: 'low', tsbNow: -12, tsbDelta: 2, ctl: 54, atl: 66, atlDelta: -1, loadTrend: 'building' } as unknown as TrainingStatus
  const next = (workout: Partial<HeroWorkoutView>) => ({
    date: '2026-10-08', title: 'Easy + strides', km: '10', inDays: 1, kind: 'easy' as const,
    workout: { ...PLAN, type: 'Base' as const, activityId: null, ...workout },
  })

  it('draws the next session as it runs, and says what it draws', () => {
    render(
      <TodayHero
        status={status}
        plannedWorkout={null}
        todayActivity={null}
        aiVerdict={null}
        nextSession={next({ title: 'Easy · 54 min + 6 strides', shortName: 'Easy + strides', structure: STRIDES, duration: { seconds: 3_693, estimated: false } })}
      />,
    )

    const bar = screen.getByTestId('today-structure-bar')
    expect(bar.querySelectorAll('[aria-hidden] > span')).toHaveLength(7)
    expect(bar).toHaveTextContent('54 min · Z2')
    expect(bar).toHaveTextContent(t.plan.structure.strides(6, t.plan.session.seconds(20)))
    // The tile has room for the whole name.
    expect(screen.getByTestId('session-tile')).toHaveTextContent('Easy · 54 min + 6 strides')
  })

  it('is one block for a session without steps', () => {
    render(<TodayHero status={status} plannedWorkout={null} todayActivity={null} aiVerdict={null} nextSession={next({ title: 'Easy run', structure: null, duration: null })} />)

    const bar = screen.getByTestId('today-structure-bar')
    expect(bar.querySelectorAll('[aria-hidden] > span')).toHaveLength(1)
    expect(bar).toHaveTextContent(`Z2 ${t.plan.continuous}`)
  })

  it('keeps an older, longer name to two lines beside its button', () => {
    render(<TodayHero status={status} plannedWorkout={null} todayActivity={null} aiVerdict={null} nextSession={next({ title: "Répétitions allure d'objectif - 4x3'@4:24" })} />)

    expect(screen.getByText("Répétitions allure d'objectif - 4x3'@4:24").className).toContain('line-clamp-2')
  })
})
