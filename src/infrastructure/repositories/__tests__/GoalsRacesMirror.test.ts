import fs from 'fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn(), readdirSync: vi.fn(() => []), existsSync: vi.fn(() => true) },
}))

function serve(files: Record<string, unknown>) {
  vi.mocked(fs.readFileSync).mockImplementation((file) => {
    const name = Object.keys(files).find((candidate) => String(file).endsWith(`/${candidate}`))
    if (!name) throw Object.assign(new Error('absent'), { code: 'ENOENT' })
    return JSON.stringify(files[name])
  })
}

beforeEach(() => {
  vi.resetModules()
})

describe('the races and goals every reader gets', () => {
  it('lays the mirrored app entries over what Garmin and goals.json say', async () => {
    serve({
      'upcoming_races.json': { races: [
        { garminEventUuid: 'uuid-1', date: '2026-11-29', name: 'Harbor Lights 10K', distance: '10K', isPrimaryEvent: true },
        { garminEventUuid: 'uuid-2', date: '2026-12-13', name: 'Corrida', distance: '10K' },
      ] },
      'race_entries.json': { races: {
        abc: { name: 'Autumn Trail Half', date: '2027-05-29', distanceKm: 21.0975, priority: 'A', targetSeconds: 5_700 },
        'garmin-uuid-1': { garminKey: 'uuid-1', name: 'Harbor Lights 10K', date: '2026-11-29', distanceKm: 10, priority: 'C' },
        'garmin-uuid-2': { garminKey: 'uuid-2', removed: true },
      } },
      'goals.json': { years: [{ year: 2026, annualDistanceKm: 1_200, targets: [{ distance: '10K', target: '45:00' }] }] },
      'goal_entries.json': { goals: { 2027: { annualDistanceKm: 1_500, targets: { half: 5_700 } } } },
    })
    const { getUpcomingRaceYears } = await import('../JsonUpcomingRaceRepository')
    const { getGoalYears } = await import('../JsonGoalRepository')

    expect(getUpcomingRaceYears().map(({ year, races }) => [year, races.map((race) => [race.name, race.priority])])).toEqual([
      [2026, [['Harbor Lights 10K', 'C']]],
      [2027, [['Autumn Trail Half', 'A']]],
    ])
    expect(getGoalYears()).toEqual([
      { year: 2026, annualDistanceKm: 1_200, targets: [{ distance: '10K', targetSeconds: 2_700 }] },
      { year: 2027, annualDistanceKm: 1_500, targets: [{ distance: 'Half-Marathon', targetSeconds: 5_700 }] },
    ])
  })

  it('reads the files alone before the first mirror', async () => {
    serve({ 'upcoming_races.json': { races: [{ garminEventId: 7, date: '2026-11-29', name: 'Cross', distance: '8 km', isTrainingEvent: true }] } })
    const { getUpcomingRaceYears } = await import('../JsonUpcomingRaceRepository')

    expect(getUpcomingRaceYears()).toEqual([
      { year: 2026, races: [{ garminEventId: 7, date: '2026-11-29', name: 'Cross', distance: '8 km', isTrainingEvent: true, priority: 'C' }] },
    ])
  })
})
