import { describe, expect, it } from 'vitest'
import { wearOutlook, wearStatus } from '../wearStatus'

describe('wearStatus', () => {
  it('bands the wear percentage', () => {
    expect(wearStatus(50)).toBe('ok')
    expect(wearStatus(70)).toBe('watch')
    expect(wearStatus(90)).toBe('replace')
  })
})

describe('wearOutlook', () => {
  it('projects the weeks left from the recent rate', () => {
    expect(wearOutlook({ totalKm: 640, maxKm: 800, wearPercent: 80, kmPerWeek: 40 })).toEqual({
      status: 'watch',
      kmLeft: 160,
      weeksRemaining: 4,
    })
  })

  it('has no timeline to give without a rate', () => {
    expect(wearOutlook({ totalKm: 640, maxKm: 800, wearPercent: 80, kmPerWeek: 0 }).weeksRemaining).toBeNull()
  })

  it('never reports negative kilometres left past the limit', () => {
    expect(wearOutlook({ totalKm: 900, maxKm: 800, wearPercent: 100, kmPerWeek: 40 })).toEqual({
      status: 'replace',
      kmLeft: 0,
      weeksRemaining: 0,
    })
  })
})
