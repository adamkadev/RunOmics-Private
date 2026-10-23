import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildCoachingOverview, type PrescriptionView } from '@/application/coaching/GetCoachingView'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { PlannedWorkoutCard } from '../PlanDayCard'
import type { PlanWorkoutView } from '../planWorkoutView'
import type { DayKind } from '../sessionKind'
import { WeekView } from '../WeekView'

// Explore, E5: "Find a route" on a session still to come opens the map's
// route generator with the session's distance.

/** Today's real-shaped easy run: 8 km + 6 strides is 9.46 km in 55:36 in all. */
const EASY: PlanWorkoutView = {
  key: 'workout-easy',
  date: '2026-09-09',
  title: 'Easy · 8 km + 6 strides',
  type: 'Base',
  duration: { seconds: 3_336, estimated: false },
  distanceM: 9_462,
  effort: null,
  target: null,
  description: null,
  notes: [],
  structure: null,
  hr: null,
  statusLabel: '',
  alert: null,
  activityId: null,
  isKey: false,
}
const EASY_KIND: DayKind = { type: 'Base', kind: 'easy', color: 'var(--zone-2)' }
const RACE_KIND: DayKind = { type: 'Race', kind: 'quality', color: 'var(--zone-5)' }

const button = () => screen.queryByTestId('find-route')

describe('Find a route on a planned session', () => {
  it('opens the generator with the whole session on the 0.5 km grid, at its average pace, from Plan', () => {
    render(<PlannedWorkoutCard workout={EASY} kind={EASY_KIND} exploreAvailable />)

    const link = button()!
    expect(link.tagName).toBe('A')
    // 9.462 km → 9.5; 3336 s / 9.462 km = 352.6 → 353 s/km; the session's day.
    expect(link.getAttribute('href')).toBe('/activities?view=map&explore=route&km=9.5&pace=353&date=2026-09-09&from=plan')
    expect(link.textContent).toBe(t.plan.session.findRoute)
    expect(link.querySelector('svg.lucide-map-pin')).not.toBeNull()
    // A full-width tinted secondary button with accent text, 50 pt.
    expect(link.className).toContain('w-full')
    expect(link.className).toContain('h-[50px]')
    expect(link.className).toContain('bg-[var(--fill-3)]')
    expect(link.className).toContain('text-accent-text')
    expect(link.className).not.toContain('text-foreground')
  })

  it('closes the card, after the targets', () => {
    render(<PlannedWorkoutCard workout={EASY} kind={EASY_KIND} exploreAvailable />)

    const card = screen.getByTestId('plan-workout-workout-easy')
    expect(card.lastElementChild).toBe(button())
  })

  it('without a duration, takes the middle of the session’s easy pace - else leaves the pace out', () => {
    const structure = [{ kind: 'effort' as const, minutes: 40, paceSecPerKm: [330, 384] as [number, number] }]
    const { unmount } = render(<PlannedWorkoutCard workout={{ ...EASY, duration: null, structure }} kind={EASY_KIND} exploreAvailable />)
    expect(button()!.getAttribute('href')).toBe('/activities?view=map&explore=route&km=9.5&pace=357&date=2026-09-09&from=plan')
    unmount()

    render(<PlannedWorkoutCard workout={{ ...EASY, duration: null }} kind={EASY_KIND} exploreAvailable />)
    expect(button()!.getAttribute('href')).toBe('/activities?view=map&explore=route&km=9.5&date=2026-09-09&from=plan')
  })

  it('is not there when the athlete has no quartiers to explore', () => {
    render(<PlannedWorkoutCard workout={EASY} kind={EASY_KIND} />)
    expect(button()).toBeNull()
  })

  it('is not there for a session with no distance', () => {
    render(<PlannedWorkoutCard workout={{ ...EASY, distanceM: null }} kind={EASY_KIND} exploreAvailable />)
    expect(button()).toBeNull()
  })

  it('is not there for a race', () => {
    render(<PlannedWorkoutCard workout={{ ...EASY, type: 'Race' }} kind={RACE_KIND} exploreAvailable />)
    expect(button()).toBeNull()
  })

  it('changes nothing else in the card', () => {
    const { container: without } = render(<PlannedWorkoutCard workout={EASY} kind={EASY_KIND} />)
    const before = without.innerHTML
    const { container: withRoute } = render(<PlannedWorkoutCard workout={EASY} kind={EASY_KIND} exploreAvailable />)
    withRoute.querySelector('[data-testid="find-route"]')!.remove()
    expect(withRoute.innerHTML).toBe(before)
  })
})

describe('Find a route through the week', () => {
  const TODAY = '2026-09-09'
  const coaching = buildCoachingOverview(plan(), [], [], [], [], TODAY)
  const byDateCoach = new Map<string, PrescriptionView[]>()
  for (const view of coaching.workouts) byDateCoach.set(view.prescription.date, [...(byDateCoach.get(view.prescription.date) ?? []), view])

  function week(exploreAvailable?: boolean) {
    return render(
      <WeekView
        weekStart={new Date(2026, 8, 7)}
        selectedDate={TODAY}
        onSelectDate={() => {}}
        byDate={new Map()}
        byDatePlanned={new Map()}
        byDateCoach={byDateCoach}
        coaching={coaching}
        today={TODAY}
        atPresent
        onToday={() => {}}
        planPhaseRanges={[]}
        exploreAvailable={exploreAvailable}
      />,
    )
  }

  it("reaches the selected day's session card", () => {
    week(true)

    const card = screen.getByTestId('plan-workout-workout-threshold')
    const link = within(card).getByTestId('find-route')
    expect(link.getAttribute('href')).toMatch(/^\/activities\?view=map&explore=route&km=\d+(\.5)?(&pace=\d+)?&date=2026-09-09&from=plan$/)
  })

  it('stays off unless the page says Explore is there', () => {
    week()
    expect(button()).toBeNull()
  })
})
