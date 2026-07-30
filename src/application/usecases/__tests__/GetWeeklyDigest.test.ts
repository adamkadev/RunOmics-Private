import { describe, it, expect } from 'vitest'
import { buildPrFacts, buildStatusFact, buildLoadRiskFacts, buildHardShareFact, weekRemainder } from '../GetWeeklyDigest'
import type { Activity } from '@/domain/activity/types'
import type { RecordEntry } from '../GetRecords'
import type { TrainingStatus } from '../GetTrainingStatus'
import type { LoadRiskPanel } from '../GetLoadRiskPanel'
import { isoWeekNumber } from '@/lib/calendarDate'

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
    acwrSource: null,
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

describe('weekRemainder', () => {
  // Wednesday 2026-07-29: Thursday through Sunday are still ahead.
  const wednesday = new Date('2026-07-29T18:00:00')
  const ran = (date: string) => ({ date }) as Activity

  it('counts today and the days after it', () => {
    expect(weekRemainder([], [], wednesday).days).toBe(5)
    expect(weekRemainder([], [], new Date('2026-08-02T09:00:00')).days).toBe(1)
  })

  it('counts the planned sessions left in those days', () => {
    const planned = ['2026-07-27', '2026-07-30', '2026-08-01', '2026-08-05']
    expect(weekRemainder([], planned, wednesday).plannedSessions).toBe(2)
  })

  it('drops a planned day already run', () => {
    const planned = ['2026-07-29', '2026-07-30']
    expect(weekRemainder([ran('2026-07-29')], planned, wednesday).plannedSessions).toBe(1)
  })
})
