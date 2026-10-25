import { describe, expect, it } from 'vitest'
import { hillyGap } from '../gradeAdjusted'

describe('hillyGap', () => {
  it('shows the grade-adjusted pace from 50 m of climbing a 10 km, never on the flat or before a reprocess', () => {
    expect(hillyGap({ gapSecPerKm: 296, elevationGain: 50, distanceKm: 10 })).toBe(296)
    expect(hillyGap({ gapSecPerKm: 299, elevationGain: 49, distanceKm: 10 })).toBeNull()
    expect(hillyGap({ elevationGain: 120, distanceKm: 10 })).toBeNull()
  })
})
