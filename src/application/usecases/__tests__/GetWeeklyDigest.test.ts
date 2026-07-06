import { describe, it, expect } from 'vitest'
import {
  daysUntil,
  buildPrFacts,
  buildStatusFact,
  buildLoadRiskFacts,
  buildHardShareFact,
  buildNextRaceFact,
  buildNextKeySessionFact,
} from '../GetWeeklyDigest'
import type { RecordEntry } from '../GetRecords'
import type { TrainingStatus } from '../GetTrainingStatus'
import type { LoadRiskPanel } from '../GetLoadRiskPanel'
import type { PlannedWorkout } from '@/domain/activity/types'
import { isoWeekNumber } from '@/lib/calendarDate'

describe('daysUntil', () => {
  it('computes whole-day difference', () => {
    expect(daysUntil('2026-07-20', '2026-07-06')).toBe(14)
    expect(daysUntil('2026-07-06', '2026-07-06')).toBe(0)
  })
})

describe('buildPrFacts', () => {
  const record = (key: string, date: string | null, seconds: number | null = 1200): RecordEntry => ({
    key,
    label: key.toUpperCase(),
    seconds,
    paceSecPerKm: 240,
    activityId: 'a1',
    date,
    official: false,
  })

  it('includes a record set within the current week', () => {
    const currentWeek = isoWeekNumber(new Date('2026-07-01T00:00:00'))
    const facts = buildPrFacts([record('5k', '2026-07-01')], currentWeek)
    expect(facts).toHaveLength(1)
    expect(facts[0]?.severity).toBe('positive')
  })

  it('excludes records outside the current week', () => {
    const currentWeek = isoWeekNumber(new Date('2026-07-01T00:00:00'))
    const facts = buildPrFacts([record('5k', '2026-01-01')], currentWeek)
    expect(facts).toHaveLength(0)
  })

  it('excludes records with no date or no time', () => {
    const currentWeek = isoWeekNumber(new Date('2026-07-01T00:00:00'))
    const facts = buildPrFacts([record('5k', null), record('10k', '2026-07-01', null)], currentWeek)
    expect(facts).toHaveLength(0)
  })
})

describe('buildStatusFact', () => {
  const status = (over: Partial<TrainingStatus>): TrainingStatus =>
    ({ status: 'productive', risk: 'low', loadTrend: 'maintaining', ctl: 50, atl: 40, tsb: 10, acwr: null, ctlDelta: 0, ...over }) as TrainingStatus

  it('positive fact for fresh', () => {
    const fact = buildStatusFact(status({ status: 'fresh', tsb: 12 }))
    expect(fact?.severity).toBe('positive')
  })

  it('watch fact for overreaching', () => {
    const fact = buildStatusFact(status({ status: 'overreaching', tsb: -35 }))
    expect(fact?.severity).toBe('watch')
  })

  it('null for unremarkable statuses', () => {
    expect(buildStatusFact(status({ status: 'productive' }))).toBeNull()
    expect(buildStatusFact(null)).toBeNull()
  })
})

describe('buildLoadRiskFacts', () => {
  const base: LoadRiskPanel = {
    acwr: null,
    acwrZone: null,
    monotony: null,
    monotonyZone: null,
    strain: null,
    strainZone: null,
    rampRate: null,
    rampRateZone: null,
    daysOfHistory: 30,
  }

  it('empty when null or all zones are safe', () => {
    expect(buildLoadRiskFacts(null)).toEqual([])
    expect(buildLoadRiskFacts({ ...base, acwr: 1.0, acwrZone: 'safe', monotony: 1.2, monotonyZone: 'safe' })).toEqual([])
  })

  it('flags acwr in caution/risk', () => {
    const facts = buildLoadRiskFacts({ ...base, acwr: 1.6, acwrZone: 'risk' })
    expect(facts).toHaveLength(1)
    expect(facts[0]?.key).toBe('acwr')
  })

  it('flags monotony in caution/risk', () => {
    const facts = buildLoadRiskFacts({ ...base, monotony: 2.5, monotonyZone: 'risk' })
    expect(facts).toHaveLength(1)
    expect(facts[0]?.key).toBe('monotony')
  })

  it('flags both at once', () => {
    const facts = buildLoadRiskFacts({ ...base, acwr: 1.6, acwrZone: 'risk', monotony: 2.5, monotonyZone: 'caution' })
    expect(facts).toHaveLength(2)
  })
})

describe('buildHardShareFact', () => {
  it('null at or below the threshold, or when unknown', () => {
    expect(buildHardShareFact(null)).toBeNull()
    expect(buildHardShareFact(30)).toBeNull()
    expect(buildHardShareFact(20)).toBeNull()
  })

  it('watch fact above the threshold', () => {
    expect(buildHardShareFact(35)?.severity).toBe('watch')
  })
})

describe('buildNextRaceFact', () => {
  it('null with no race', () => {
    expect(buildNextRaceFact(null, '2026-07-06')).toBeNull()
  })

  it('includes the race name and countdown', () => {
    const fact = buildNextRaceFact({ date: '2026-07-20', name: 'City Half', distance: 'Half-Marathon' }, '2026-07-06')
    expect(fact?.text).toContain('City Half')
  })
})

describe('buildNextKeySessionFact', () => {
  const plan = (over: Partial<PlannedWorkout>): PlannedWorkout => ({ date: '2026-07-10', name: 'p', ...over })

  it('picks the nearest future non-Base planned session', () => {
    const planned = [plan({ date: '2026-07-08', type: 'Base' }), plan({ date: '2026-07-09', type: 'Threshold' })]
    const fact = buildNextKeySessionFact(planned, '2026-07-06')
    expect(fact?.text).toContain('Threshold')
  })

  it('null when only past or Base sessions exist', () => {
    const planned = [plan({ date: '2026-07-01', type: 'Threshold' }), plan({ date: '2026-07-09', type: 'Base' })]
    expect(buildNextKeySessionFact(planned, '2026-07-06')).toBeNull()
  })

  it('null with no planned workouts', () => {
    expect(buildNextKeySessionFact([], '2026-07-06')).toBeNull()
  })
})
