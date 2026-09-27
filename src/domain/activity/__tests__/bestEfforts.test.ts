import { describe, expect, it } from 'vitest'
import { plausibleBestEfforts } from '../bestEfforts'

describe('plausibleBestEfforts', () => {
  it('keeps every effort inside the moving time', () => {
    const efforts = { '1k': 300, '5k': 1600, '10k': 3320 }
    expect(plausibleBestEfforts(efforts, 3387)).toBe(efforts)
  })

  it('drops an effort longer than the run took: a 10K at 1:02:18 on a 56:27 run', () => {
    expect(plausibleBestEfforts({ '5k': 1640, '10k': 3738 }, 3387)).toEqual({ '5k': 1640 })
  })

  it('is empty when nothing fits, and passes through without a duration', () => {
    expect(plausibleBestEfforts({ '10k': 3738 }, 3387)).toBeNull()
    expect(plausibleBestEfforts({ '10k': 3738 }, undefined)).toEqual({ '10k': 3738 })
  })
})
