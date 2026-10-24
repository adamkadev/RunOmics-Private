import { describe, expect, it } from 'vitest'
import { heatAdjustedEf } from '@/domain/activity/heat'

describe('chart guards (G07)', () => {
  it('keeps a run without a temperature as measured instead of NaN', () => {
    expect(heatAdjustedEf(2.9, { apparentTempC: undefined } as never)).toBe(2.9)
    expect(Number.isFinite(heatAdjustedEf(2.9, { apparentTempC: NaN } as never))).toBe(true)
  })
})
