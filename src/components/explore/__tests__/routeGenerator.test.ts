import { describe, expect, it } from 'vitest'
import { easyPaceOf } from '../routeGenerator'

const run = (type: 'Base' | 'Threshold', date: string, paceSecPerKm: number) => ({ type, date, paceSecPerKm })

describe('easyPaceOf', () => {
  it('is the median of the last eight weeks’ easy runs, then every easy run, then every run', () => {
    const rows = [
      run('Base', '2026-10-20', 348),
      run('Threshold', '2026-10-21', 300),
      run('Base', '2026-10-15', 341),
      run('Base', '2026-10-10', 359),
      run('Base', '2026-03-01', 380),
    ]
    expect(easyPaceOf(rows, [0, 1, 2, 3, 4], '2026-10-24')).toBe(348)
    expect(easyPaceOf(rows, [0, 1, 4], '2026-10-24')).toBe(364)
    expect(easyPaceOf(rows, [1], '2026-10-24')).toBe(300)
  })
})
