import { describe, expect, it } from 'vitest'
import { easyPaceOf, generatorDay, runStart, type ExplorePlan } from '../routeGenerator'

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

describe('generatorDay', () => {
  const plan = (date: string, session: ExplorePlan['session']): ExplorePlan => ({ date, label: '', distanceM: null, paceSecPerKm: null, session, hour: null })
  const plans = [plan('2026-10-26', 'easy'), plan('2026-10-27', 'quality'), plan('2026-10-29', 'long')]

  it('is the plan’s session, and the day before a quality one says so', () => {
    expect(generatorDay(plans, plans[0]!, '2026-10-26')).toEqual({ session: 'easy', beforeQuality: true })
    expect(generatorDay(plans, plans[2]!, '2026-10-26')).toEqual({ session: 'long', beforeQuality: false })
  })

  it('knows the day before a quality session even with nothing planned for it', () => {
    expect(generatorDay(plans, null, '2026-10-26')).toEqual({ session: null, beforeQuality: true })
  })
})

describe('runStart', () => {
  const NOW = Date.parse('2026-10-27T07:30:00Z')
  const plan = (date: string, hour: number | null) => ({ date, hour })

  it('is now for today’s loop or none planned', () => {
    expect(runStart(null, '2026-10-27', NOW)).toEqual({ date: '2026-10-27', now: NOW })
    expect(runStart(plan('2026-10-27', 18), '2026-10-27', NOW)).toEqual({ date: '2026-10-27', now: NOW })
  })

  it('is the usual hour on a later planned day', () => {
    const start = runStart(plan('2026-10-30', 18), '2026-10-27', NOW)
    expect(start.date).toBe('2026-10-30')
    expect(new Date(start.now).toISOString()).toBe('2026-10-30T17:00:00.000Z')
  })

  it('is this hour of the day on that day without a usual hour', () => {
    expect(new Date(runStart(plan('2026-10-30', null), '2026-10-27', NOW).now).toISOString()).toBe('2026-10-30T07:30:00.000Z')
  })
})
