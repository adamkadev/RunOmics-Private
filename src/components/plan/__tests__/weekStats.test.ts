import { describe, expect, it } from 'vitest'
import { adherenceTone, planAdherence, PLAN_ADHERENCE_AIM } from '../weekStats'

describe('plan adherence', () => {
  it('is the share of the sessions due that were run', () => {
    expect(planAdherence({ planKm: 40, plannedDone: 3, missedSessions: 1 })).toBe(75)
    expect(planAdherence({ planKm: 40, plannedDone: 2, missedSessions: 0 })).toBe(100)
  })

  // A week that has not started, or whose sessions are all still to come,
  // reads nothing - not 0%.
  it('is nothing until a session is due, and nothing without a plan', () => {
    expect(planAdherence({ planKm: 40, plannedDone: 0, missedSessions: 0 })).toBeNull()
    expect(planAdherence({ planKm: null, plannedDone: 0, missedSessions: 0 })).toBeNull()
  })

  it('reads the aim as met, short, or not yet', () => {
    expect(PLAN_ADHERENCE_AIM).toBe(80)
    expect(adherenceTone(80)).toBe('pos')
    expect(adherenceTone(79)).toBe('warn')
    expect(adherenceTone(null)).toBe('muted')
  })
})
