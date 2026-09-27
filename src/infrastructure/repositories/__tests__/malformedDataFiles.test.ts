import fs from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn(), readdirSync: vi.fn(() => []), existsSync: vi.fn(() => true) },
}))

/** What a sync interrupted mid-write leaves on disk. */
const TRUNCATED = '{"years": [{"year": 2026, "targ'

let warn: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  vi.mocked(fs.readFileSync).mockReturnValue(TRUNCATED)
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
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
    ['recovery_history.json', '../JsonRecoveryRepository', 'getRecoveryNights', []],
    ['vo2max_history.json', '../JsonVo2maxHistoryRepository', 'getVo2maxSamples', { months: [], days: [] }],
  ])('%s', async (_file, modulePath, exportName, empty) => {
    const repository = (await import(modulePath)) as Record<string, () => unknown>

    expect(repository[exportName]!()).toEqual(empty)
  })

  it('says which file was unreadable, rather than swallowing it', async () => {
    const { getGoalYears } = await import('../JsonGoalRepository')
    getGoalYears()

    expect(String(warn.mock.calls[0]?.[0])).toContain('goals.json')
  })
})

describe('a well-formed file still reads normally', () => {
  it('goals.json', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ years: [{ year: 2026, annualDistanceKm: 1500, targets: [] }] })
    )
    const { getGoalYears } = await import('../JsonGoalRepository')

    expect(getGoalYears()).toEqual([{ year: 2026, annualDistanceKm: 1500, targets: [] }])
  })
})
