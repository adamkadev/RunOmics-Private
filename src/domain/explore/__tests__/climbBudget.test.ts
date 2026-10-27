import { describe, expect, it } from 'vitest'
import { climbBudget, type SessionDay } from '../climbBudget'

const day = (session: SessionDay['session'], beforeQuality = false): SessionDay => ({ session, beforeQuality })

describe('climbBudget', () => {
  it.each([
    ['a quality day', day('quality'), null],
    ['the day before a quality session', day('easy', true), 12],
    ['a recovery run', day('recovery'), 12],
    ['a long run', day('long'), 15],
    ['an easy run', day('easy'), 20],
    ['no known session', day(null), 20],
  ])('allows %s %s m/km', (_label, session, max) => {
    expect(climbBudget(session).maxMPerKm).toBe(max)
  })

  it('counts steep descents on a long run only', () => {
    expect(climbBudget(day('long')).steepDescents).toBe(true)
    expect(climbBudget(day('easy')).steepDescents).toBe(false)
  })
})
