import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { formatDate } from '@/lib/formatters'
import type { PlanCoachingView } from '../planCoachingView'
import { planRace, raceSubtitle, raceTitle, raceWeekLabel } from '../planRace'

const TODAY = '2026-09-28'

function coaching(targetDate: string, tuneUps: PlanCoachingView['plan']['tuneUpEvents'] = []): PlanCoachingView {
  return {
    plan: {
      block: { startDate: '2026-09-23', endDate: '2026-10-20' },
      targetEvent: { date: targetDate, name: '10 km', role: 'primary', distanceLabel: '10K', location: 'Wintzenheim' },
      tuneUpEvents: tuneUps,
    },
    workouts: [],
  }
}

describe('planRace', () => {
  it("reads the coaching block's target race", () => {
    expect(planRace(coaching('2026-11-29'), null, TODAY)).toEqual({ date: '2026-11-29', name: '10 km', distance: '10K', location: 'Wintzenheim' })
  })

  it('falls back to a tune-up still to come once the target is past', () => {
    const race = planRace(coaching('2026-09-20', [{ date: '2026-10-11', name: 'Club 5K', role: 'tune_up', distanceLabel: '5K' }]), null, TODAY)
    expect(race?.name).toBe('Club 5K')
  })

  it("reads Garmin's next race without coaching, and nothing once it is past", () => {
    const next = { date: '2026-10-18', name: 'City Half', distance: 'Half-Marathon' }
    expect(planRace(null, next, TODAY)).toBe(next)
    expect(planRace(null, { ...next, date: '2026-09-27' }, TODAY)).toBeNull()
    expect(planRace(null, null, TODAY)).toBeNull()
  })
})

describe('the race in words', () => {
  // v4.17: "10K Wintzenheim · Nov 29 · 62 days to go".
  it('names a distance-only race by its distance and place', () => {
    expect(raceTitle({ date: '2026-11-29', name: '10 km', distance: '10K', location: 'Wintzenheim' })).toBe('10K Wintzenheim')
    expect(raceTitle({ date: '2026-11-29', name: '10K', distance: '10K' })).toBe('10K')
    expect(raceTitle({ date: '2026-10-18', name: 'City Half', distance: 'Half-Marathon', location: 'Strasbourg' })).toBe('City Half')
  })

  it('writes the header subtitle with its countdown', () => {
    const race = { date: '2026-11-29', name: '10 km', distance: '10K', location: 'Wintzenheim' }
    expect(raceSubtitle(race, TODAY)).toBe(`10K Wintzenheim · ${formatDate('2026-11-29', { style: 'bare' })} · ${t.plan.header.daysToGo(62)}`)
    expect(t.plan.header.daysToGo(62)).toBe('62 days to go')
    expect(t.plan.header.daysToGo(1)).toBe('1 day to go')
    expect(t.plan.header.daysToGo(0)).toBe('race day')
  })

  it("names the race's week by its Monday", () => {
    expect(raceWeekLabel({ date: '2026-11-29', name: '10 km', distance: '10K' })).toBe(t.plan.phaseTrack.raceWeek(formatDate('2026-11-23', { style: 'bare' })))
  })
})
