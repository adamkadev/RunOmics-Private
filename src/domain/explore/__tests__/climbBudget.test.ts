import { describe, expect, it } from 'vitest'
import { climbBudget, type SessionDay } from '../climbBudget'

const day = (session: SessionDay['session'], beforeQuality = false): SessionDay => ({ session, beforeQuality })

describe('climbBudget', () => {
  it.each([
    ['a quality day', day('quality'), false, null],
    ['the day before a quality session', day('easy', true), false, 12],
    ['a recovery run', day('recovery'), false, 12],
    ['a long run', day('long'), false, 15],
    ['an easy run', day('easy'), false, 20],
    ['no known session', day(null), false, 20],
    ['an easy run with Trails OK', day('easy'), true, 30],
    ['the day before a quality session with Trails OK', day('easy', true), true, 12],
    ['a quality day with Trails OK', day('quality'), true, null],
  ])('allows %s %s m/km', (_label, session, trailsOk, max) => {
    expect(climbBudget(session, trailsOk).maxMPerKm).toBe(max)
  })

  it('never lets Trails OK lift the trail penalty on or before a quality day', () => {
    expect(climbBudget(day('quality'), true).trailsOk).toBe(false)
    expect(climbBudget(day('easy', true), true).trailsOk).toBe(false)
    expect(climbBudget(day('long'), true).trailsOk).toBe(true)
  })

  it('counts steep descents on a long run only', () => {
    expect(climbBudget(day('long'), false).steepDescents).toBe(true)
    expect(climbBudget(day('easy'), false).steepDescents).toBe(false)
  })
})
