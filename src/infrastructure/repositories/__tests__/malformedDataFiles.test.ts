import fs from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn(), readdirSync: vi.fn(() => []), existsSync: vi.fn(() => true) },
}))

/**
 * What a sync interrupted mid-write leaves on disk. Before these repositories
 * shared one reader, half of them turned this into an empty section and the
 * other half threw it out of a server component, taking the whole page with
 * it - and which you got depended only on which file happened to be truncated.
 */
const TRUNCATED = '{"years": [{"year": 2026, "targ'

beforeEach(() => {
  vi.resetModules()
  vi.mocked(fs.readFileSync).mockReturnValue(TRUNCATED)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a truncated data file degrades the section instead of the page', () => {
  it('goals.json', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getGoalYears } = await import('../JsonGoalRepository')

    expect(getGoalYears()).toEqual([])
    expect(warn).toHaveBeenCalled()
  })

  it('pbs.json', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getPbYears } = await import('../JsonPbRepository')

    expect(getPbYears()).toEqual([])
  })

  it('athlete.json', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getAthleteProfile } = await import('../JsonAthleteRepository')

    expect(getAthleteProfile()).toEqual({})
  })

  it('race_results.json', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getOfficialRaceResults } = await import('../JsonRaceResultRepository')

    expect(getOfficialRaceResults()).toEqual([])
  })

  it('upcoming_races.json', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getUpcomingRaceYears } = await import('../JsonUpcomingRaceRepository')

    expect(getUpcomingRaceYears()).toEqual([])
  })

  it('training_status.json', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getTrainingStatusDays } = await import('../JsonTrainingStatusRepository')

    expect(getTrainingStatusDays()).toEqual([])
  })

  it('vo2max_history.json', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getVo2maxSamples } = await import('../JsonVo2maxHistoryRepository')

    expect(getVo2maxSamples()).toEqual({ months: [], days: [] })
  })

  it('says which file was unreadable, rather than swallowing it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
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
