import { describe, expect, it } from 'vitest'
import { isRunningSince, runningSinceBefore, runningYears } from '../runningSince'

describe('runningSince', () => {
  it('accepts a year or a month, nothing else', () => {
    expect(isRunningSince('2021')).toBe(true)
    expect(isRunningSince('2021-04')).toBe(true)
    expect(isRunningSince('2021-13')).toBe(false)
    expect(isRunningSince('2021-04-01')).toBe(false)
    expect(isRunningSince(2021)).toBe(false)
  })

  it('counts whole years, a bare year from its January', () => {
    expect(runningYears('2021', '2026-11-21')).toBe(5)
    expect(runningYears('2021-12', '2026-11-21')).toBe(4)
    expect(runningYears('2026-03', '2026-11-21')).toBe(0)
  })

  it('reads only when it goes back before the first synced run', () => {
    expect(runningSinceBefore('2021', '2025-05-03', '2026-11-21')).toEqual({ since: '2021', years: 5 })
    expect(runningSinceBefore('2025', '2025-05-03', '2026-11-21')).toBeNull()
    expect(runningSinceBefore('2025-05', '2025-05-03', '2026-11-21')).toBeNull()
    expect(runningSinceBefore('2025-04', '2025-05-03', '2026-11-21')).toEqual({ since: '2025-04', years: 1 })
    expect(runningSinceBefore('2021', null, '2026-11-21')).toEqual({ since: '2021', years: 5 })
  })

  it('ignores a value that is not a year or a month', () => {
    expect(runningSinceBefore('long ago', '2025-05-03', '2026-11-21')).toBeNull()
    expect(runningSinceBefore(undefined, '2025-05-03', '2026-11-21')).toBeNull()
  })
})
