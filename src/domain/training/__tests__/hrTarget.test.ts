import { describe, expect, it } from 'vitest'
import { hrZoneCapBpm, sessionHrCapBpm } from '../hrTarget'

const BOUNDS = [128, 145, 160, 172, 182]

describe('hrZoneCapBpm', () => {
  // A zone stops one beat under the next one, as the zone table reads it.
  it('caps a zone one beat under the next', () => {
    expect(hrZoneCapBpm(2, BOUNDS)).toBe(159)
    expect(hrZoneCapBpm(4, BOUNDS)).toBe(181)
  })

  // Z5 is open-ended, and without the athlete's bounds there is no cap to give.
  it('has no cap for the top zone or without bounds', () => {
    expect(hrZoneCapBpm(5, BOUNDS)).toBeNull()
    expect(hrZoneCapBpm(2, null)).toBeNull()
    expect(hrZoneCapBpm(null, BOUNDS)).toBeNull()
  })
})

describe('sessionHrCapBpm', () => {
  it('takes the coach’s own cap over the zone’s', () => {
    expect(sessionHrCapBpm({ capBpm: 152, zone: 2 }, BOUNDS)).toBe(152)
  })

  it('falls back to the zone, and to nothing without a target', () => {
    expect(sessionHrCapBpm({ capBpm: null, zone: 3 }, BOUNDS)).toBe(171)
    expect(sessionHrCapBpm(null, BOUNDS)).toBeNull()
  })
})
