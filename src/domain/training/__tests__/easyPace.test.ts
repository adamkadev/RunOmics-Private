import { describe, expect, it } from 'vitest'
import { easyPaceReading } from '../easyPace'

const week = (i: number, easyPace: number | null) => ({ date: `2026-0${1 + Math.floor(i / 4)}-0${1 + (i % 4)}`, easyPace })

describe('easyPaceReading', () => {
  it('is null without an easy week', () => {
    expect(easyPaceReading([week(0, null)])).toBeNull()
  })

  it('reads the median of the latest four weeks with an easy run', () => {
    const weeks = [330, 331, 332, 333, 325, 326, 320, 318].map((p, i) => week(i, p))
    expect(easyPaceReading(weeks)?.now).toBe(322.5)
  })

  it('compares against the first block and names the date it starts', () => {
    const weeks = [340, null, 338, 336, 334, 320, 322, 324, 326].map((p, i) => week(i, p))
    expect(easyPaceReading(weeks)?.start).toEqual({ pace: 337, date: weeks[0]!.date })
  })

  it('has no baseline under two blocks', () => {
    expect(easyPaceReading([320, 321, 322].map((p, i) => week(i, p)))?.start).toBeNull()
  })
})
