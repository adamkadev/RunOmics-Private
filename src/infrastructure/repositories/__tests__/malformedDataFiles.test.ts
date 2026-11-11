import fs from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn(), readdirSync: vi.fn(() => []), existsSync: vi.fn(() => true) },
}))

/** What a sync interrupted mid-write leaves on disk. */
const TRUNCATED = '{"years": [{"year": 2026, "targ'

beforeEach(() => {
  vi.resetModules()
  vi.mocked(fs.readFileSync).mockReturnValue(TRUNCATED)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a truncated data file degrades the section instead of the page', () => {
  it.each([
    ['goals.json', '../JsonGoalRepository', 'getGoalYears', []],
    ['pbs.json', '../JsonPbRepository', 'getPbYears', []],
    ['athlete.json', '../JsonAthleteRepository', 'getAthleteProfile', {}],
    ['race_results.json', '../JsonRaceResultRepository', 'getOfficialRaceResults', []],
    ['upcoming_races.json', '../JsonUpcomingRaceRepository', 'getUpcomingRaceYears', []],
    ['training_status.json', '../JsonTrainingStatusRepository', 'getTrainingStatusDays', []],
    ['recovery_history.json', '../JsonRecoveryRepository', 'getRecoveryDays', []],
    ['health_history.json', '../JsonHealthRepository', 'getHealthDays', []],
    ['vo2max_history.json', '../JsonVo2maxHistoryRepository', 'getVo2maxSamples', { months: [], days: [] }],
  ])('%s', async (_file, modulePath, exportName, empty) => {
    const repository = (await import(modulePath)) as Record<string, () => unknown>

    expect(repository[exportName]!()).toEqual(empty)
  })
})

describe('a well-formed file still reads normally', () => {
  // Garmin's daily resting HR carries workout readings on some days (142 bpm
  // in Aug 2026), which the Recovery baseline took for resting.
  // A file synced before HRV was dropped still carries it; it is ignored.
  it('recovery_history.json, leaving out resting heart rates no heart at rest has', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ days: { '2026-08-14': { restingHr: 142 }, '2026-08-15': { hrv: 61, restingHr: 46 }, '2026-08-16': { hrv: 58 } } })
    )
    const { getRecoveryDays } = await import('../JsonRecoveryRepository')

    expect(getRecoveryDays()).toEqual([{ date: '2026-08-15', restingHr: 46 }])
  })

  it('health_history.json, dropping each reading no body has and a day left with none', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        days: {
          '2026-03-02': { restingHr: 47, hrvMs: 61.2, steps: 8123, sleep: { start: 'a', end: 'b', asleepMinutes: 401, awakeMinutes: 22, deepMinutes: 70 } },
          '2026-03-03': { restingHr: 140, hrvMs: 0, steps: -1, sleep: { start: 'a', end: 'b', asleepMinutes: 0 } },
          '2026-03-04': { restingHr: 48, sleep: { start: 'a', end: 'b', asleepMinutes: 380, awakeMinutes: 'x' } },
          'not-a-date': { restingHr: 48 },
        },
      })
    )
    const { getHealthDays } = await import('../JsonHealthRepository')

    expect(getHealthDays()).toEqual([
      { date: '2026-03-02', restingHr: 47, hrvMs: 61.2, steps: 8123, sleep: { start: 'a', end: 'b', asleepMinutes: 401, awakeMinutes: 22, deepMinutes: 70 } },
      { date: '2026-03-04', restingHr: 48, sleep: { start: 'a', end: 'b', asleepMinutes: 380, awakeMinutes: 0 } },
    ])
  })

  it('goals.json', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ years: [{ year: 2026, annualDistanceKm: 1500, targets: [] }] })
    )
    const { getGoalYears } = await import('../JsonGoalRepository')

    expect(getGoalYears()).toEqual([{ year: 2026, annualDistanceKm: 1500, targets: [] }])
  })
})
