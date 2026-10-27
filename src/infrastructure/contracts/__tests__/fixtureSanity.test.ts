import { describe, expect, it } from 'vitest'
import { generateDemoDataset, Z5_PACE_FLOOR_SEC } from '../../../../scripts/generate_demo_data.mjs'
import { MAX_BOOTSTRAP_WEEKS } from '@/domain/coaching/weekWindows'

/** Every rule the screens read the data by, checked on the dataset the screenshots capture. */

interface Run {
  id: string
  date: string
  type: string
  distanceKm: number
  durationSeconds: number
  paceSecPerKm: number
  avgHeartRate: number
  cadenceSpm: number
  hrZones: { zone: number; minBpm: number; maxBpm: number | null }[]
  hrSamples: number[]
  paceSamples: number[]
  cadenceSamples: number[]
  bestEfforts: Record<string, number> | null
  weather: { tempC: number; apparentTempC?: number; windKph?: number; windDirDeg?: number }
}

const NOW = new Date('2026-09-25T12:00:00Z')
const data = generateDemoDataset({ now: NOW }) as Record<string, unknown>
const athlete = data['athlete.json'] as { hrZoneBoundsBpm: number[]; maxHrBpm: number }
const runs: Run[] = Object.entries(data)
  .filter(([key]) => /^activities\/\d{4}-\d{2}\.json$/.test(key))
  .flatMap(([, value]) => (value as { activities: Run[] }).activities)
const [z1, z2, z3, z4, z5] = athlete.hrZoneBoundsBpm as [number, number, number, number, number]
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length
const KM: Record<string, number> = { '1k': 1, '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 }

describe('e2e fixture sanity', () => {
  it('has runs to check', () => {
    expect(runs.length).toBeGreaterThan(100)
  })

  it('keeps every run heart rate inside the athlete zone model', () => {
    for (const run of runs) {
      expect(run.avgHeartRate, run.id).toBeGreaterThanOrEqual(z1)
      expect(run.avgHeartRate, run.id).toBeLessThanOrEqual(athlete.maxHrBpm)
    }
  })

  it('puts each session type in its own zone', () => {
    const inZone = (type: string, lo: number, hi: number) =>
      runs.filter((r) => r.type === type).every((r) => r.avgHeartRate >= lo && r.avgHeartRate < hi)
    expect(inZone('Base', z2, z3)).toBe(true)
    expect(inZone('Tempo', z3, z4)).toBe(true)
    expect(inZone('Threshold', z4, z5)).toBe(true)
  })

  it('draws each run zones with the same bounds as Athlete & zones', () => {
    for (const run of runs) {
      expect(run.hrZones.map((z) => z.minBpm), run.id).toEqual(athlete.hrZoneBoundsBpm)
    }
  })

  it('has no run, and no best, faster than Z5 pace', () => {
    for (const run of runs) {
      expect(run.paceSecPerKm, run.id).toBeGreaterThanOrEqual(Z5_PACE_FLOOR_SEC)
      for (const [key, seconds] of Object.entries(run.bestEfforts ?? {})) {
        expect(seconds / KM[key]!, `${run.id} ${key}`).toBeGreaterThanOrEqual(Z5_PACE_FLOOR_SEC - 0.5)
      }
    }
  })

  it('has samples that average to the values the stat row prints', () => {
    for (const run of runs) {
      expect(Math.abs(mean(run.paceSamples) - run.paceSecPerKm), run.id).toBeLessThan(1)
      expect(Math.abs(mean(run.hrSamples) - run.avgHeartRate), run.id).toBeLessThan(1)
      expect(Math.abs(mean(run.cadenceSamples) - run.cadenceSpm), run.id).toBeLessThan(1)
    }
  })

  it('gives every run a feels-like temperature and a wind reading', () => {
    for (const run of runs) {
      expect(Number.isFinite(run.weather.apparentTempC), run.id).toBe(true)
      expect(Number.isFinite(run.weather.windKph), run.id).toBe(true)
      expect(Number.isFinite(run.weather.windDirDeg), run.id).toBe(true)
    }
  })

  it('rates every one of the last 28 days', () => {
    const days = (data['training_status.json'] as { days: Record<string, { status: string }> }).days
    for (let i = 0; i < 28; i++) {
      const date = new Date(NOW.getTime() - i * 86_400_000).toISOString().slice(0, 10)
      expect(days[date]?.status, date).toBeTruthy()
    }
  })

  it('names each planned workout after its type', () => {
    const byType: Record<string, string[]> = { Base: ['Easy Run', 'Long Run'], Tempo: ['Tempo'], Threshold: ['Threshold'], VO2Max: ['Intervals'] }
    const planned = Object.entries(data)
      .filter(([key]) => /^planned_workouts\/\d{4}\.json$/.test(key))
      .flatMap(([, value]) => (value as { planned: { name: string; type: string }[] }).planned)
    expect(planned.length).toBeGreaterThan(0)
    for (const w of planned) expect(byType[w.type], `${w.name} ${w.type}`).toContain(w.name)
  })

  it('plans the completed session in round numbers the run differs from', () => {
    const evaluations = Object.entries(data).find(([key]) => /^coaching\/evaluations\/\d{4}-\d{2}\.json$/.test(key))?.[1] as
      | { evaluations: { comparison: { plannedDistanceMeters: number; actualDistanceMeters: number } }[] }
      | undefined
    const comparison = evaluations!.evaluations[0]!.comparison
    expect(comparison.plannedDistanceMeters % 1000).toBe(0)
    expect(comparison.plannedDistanceMeters).not.toBe(comparison.actualDistanceMeters)
  })

  it('fits the plan phases before the race, with the race weeks at the end', () => {
    const plan = data['training_plan.json'] as { endDate: string; phases: { phase: string; startDate: string; endDate: string }[] }
    const race = (data['upcoming_races.json'] as { races: { date: string; isPrimaryEvent: boolean }[] }).races.find((r) => r.isPrimaryEvent)!
    expect(plan.phases.at(-1)!.endDate).toBe(race.date)
    for (let i = 1; i < plan.phases.length; i++) expect(plan.phases[i]!.startDate > plan.phases[i - 1]!.endDate).toBe(true)

    // Three weeks before the race is past base, in the coaching macrocycle too.
    const coaching = data['coaching/current_plan.json'] as { macrocycleStartDate: string; targetEvent: { date: string } }
    const today = NOW.toISOString().slice(0, 10)
    const current = plan.phases.find((p) => p.startDate <= today && today <= p.endDate)
    expect(current?.phase).not.toBe('BASE')
    expect(coaching.macrocycleStartDate < today).toBe(true)
    expect(coaching.targetEvent.date).toBe(race.date)
  })

  it.each([0, 1, 2, 3, 4, 5, 6])('archives a previous plan the app can read, generated %i days on', (offset) => {
    const later = generateDemoDataset({ now: new Date(NOW.getTime() + offset * 86_400_000) }) as Record<string, unknown>
    const previous = later['coaching/superseded/demo-previous-plan.json'] as { weeks: unknown[] } | undefined
    if (previous) expect(previous.weeks.length).toBeLessThanOrEqual(MAX_BOOTSTRAP_WEEKS)
  })
})
