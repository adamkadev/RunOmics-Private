import { describe, expect, it } from 'vitest'
import { secondsForVdot } from '../vdot'

describe('secondsForVdot', () => {
  it("gives Daniels' equivalent times for VDOT 50 within ten seconds", () => {
    const daniels = { 5: 1197, 10: 2481, 21.0975: 5495, 42.195: 11449 }
    for (const [km, seconds] of Object.entries(daniels)) {
      expect(Math.abs(secondsForVdot(50, Number(km)) - seconds), km).toBeLessThanOrEqual(10)
    }
  })
})
