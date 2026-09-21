import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import { buildTrainingWorkbook, type TrainingWorkbookData } from '../GetTrainingWorkbook'

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    week: 1,
    date: '2026-01-01',
    dayOfWeek: 'Thursday',
    type: 'Base',
    typeSource: 'runomics',
    description: 'Easy run',
    durationSeconds: 1800,
    distanceKm: 5,
    paceSecPerKm: 360,
    hrZones: [
      { zone: 1, seconds: 300, percent: 16.7, minBpm: 90, maxBpm: 120 },
      { zone: 2, seconds: 1200, percent: 66.7, minBpm: 120, maxBpm: 145 },
      { zone: 4, seconds: 300, percent: 16.7, minBpm: 160, maxBpm: 175 },
    ],
    avgHeartRate: 140,
    rpe: 3,
    comment: 'Felt good',
    polyline: 'private-route',
    route: [[48.8, 2.3]],
    elevationGain: 20,
    aerTrainingEffect: 2.5,
    anaTrainingEffect: 0.1,
    hrSamples: [130, 140],
    elevationProfile: [10, 20],
    calories: 350,
    cadenceSpm: 172,
    groundContactMs: 248,
    verticalOscillationMm: 89,
    verticalRatioPct: 8.2,
    strideLengthM: 1.05,
    bestEfforts: { '1k': 330, '5k': 1800 },
    splits: null,
    paceSamples: [360, 355],
    vo2maxGarmin: 52,
    avgTemperature: 12,
    cadenceSamples: [170, 174],
    gearId: 'shoe-1',
    weather: {
      tempC: 10,
      apparentTempC: 8,
      humidityPct: 70,
      windKph: 12,
      windDirDeg: 240,
      precipitationMm: 0,
      code: 2,
    },
    ...overrides,
  }
}

function data(): TrainingWorkbookData {
  return {
    activities: [
      activity(),
      activity({
        id: 'race-1',
        date: '2026-01-03',
        dayOfWeek: 'Saturday',
        type: 'Race',
        description: 'Winter 10K',
        distanceKm: 10,
        durationSeconds: 2700,
        paceSecPerKm: 270,
      }),
    ],
    athlete: { displayName: 'Runner', age: 35, restingHrBpm: 45, maxHrBpm: 190 },
    athleteHistory: [{ date: '2026-01-01', weightKg: 70 }],
    goals: [{ year: 2026, annualDistanceKm: 1000, targets: [{ distance: '10K', targetSeconds: 2600 }] }],
    pbs: [{ year: 2026, entries: [{ distance: '10K', seconds: 2700, activityId: 'race-1' }] }],
    plannedWorkouts: [{ date: '2026-01-02', name: 'Recovery run', type: 'Base', durationSecs: 1800 }],
    racePredictions: [{ date: '2026-01-02', '5k': 1250, '10k': 2600, half: 5900, marathon: 12500 }],
    shoes: [{ gearId: 'shoe-1', brand: 'Example', model: 'Daily', maxKm: 800, retired: false, firstUseDate: '2025-12-01' }],
    thresholdHistory: [{ date: '2026-01-02', lthrBpm: 170, thresholdPaceSecPerKm: 270 }],
    trainingLoadBalance: { date: '2026-01-03', aerobicLow: 200, aerobicLowMin: 180, aerobicLowMax: 300 },
    trainingPlan: { planId: 1, name: '10K plan', startDate: '2026-01-01', endDate: '2026-01-31', phases: [{ phase: 'build', startDate: '2026-01-01', endDate: '2026-01-31' }] },
    trainingStatus: [{ date: '2026-01-02', status: 'productive', acuteLoad: 300, chronicLoad: 280, acwr: 1.07 }],
    upcomingRaces: [{ year: 2026, races: [{ date: '2026-01-03', name: 'Winter 10K', distance: '10K', location: 'Paris' }] }],
    vo2maxHistory: { days: [{ date: '2026-01-02', vo2max: 52.4 }], months: [] },
  }
}

function headers(sheet: ExcelJS.Worksheet): string[] {
  return (sheet.getRow(1).values as Array<string | undefined>).slice(1).filter((value): value is string => Boolean(value))
}

describe('buildTrainingWorkbook', () => {
  it('creates the complete, ordered analysis workbook', () => {
    const workbook = buildTrainingWorkbook(data(), new Date('2026-01-03T12:00:00.000Z'))

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Guide', 'Athlete', 'Activities', 'Daily Status', 'Records', 'Races', 'Training Plan',
      'Fitness History', 'Race Predictions', 'Shoes', 'Goals', 'Load Balance',
    ])
    expect(workbook.worksheets.every((sheet) => sheet.getTables().length === 1)).toBe(true)
  })

  it('exports useful activity summaries without private routes or bulky raw samples', () => {
    const workbook = buildTrainingWorkbook(data(), new Date('2026-01-03T12:00:00.000Z'))
    const sheet = workbook.getWorksheet('Activities')!
    const columns = headers(sheet)

    expect(columns).toContain('trimp')
    expect(columns).toContain('weather_temperature_c')
    expect(columns).toContain('best_effort_5k_seconds')
    expect(columns).toContain('shoe_model')
    expect(columns).not.toContain('route')
    expect(columns).not.toContain('polyline')
    expect(columns).not.toContain('hrSamples')
  })

  it('keeps rest days in the daily status timeline', () => {
    const workbook = buildTrainingWorkbook(data(), new Date('2026-01-03T12:00:00.000Z'))
    const sheet = workbook.getWorksheet('Daily Status')!
    const columns = headers(sheet)
    const dateIndex = columns.indexOf('date') + 1
    const activityCountIndex = columns.indexOf('actual_activity_count') + 1
    const plannedIndex = columns.indexOf('planned_workout_count') + 1
    const januarySecond = [...Array(sheet.rowCount - 1)].map((_, index) => sheet.getRow(index + 2)).find((row) =>
      (row.getCell(dateIndex).value as Date).toISOString().startsWith('2026-01-02')
    )

    expect(januarySecond?.getCell(activityCountIndex).value).toBe(0)
    expect(januarySecond?.getCell(plannedIndex).value).toBe(1)
  })

  it('round-trips as a valid XLSX file', async () => {
    const workbook = buildTrainingWorkbook(data(), new Date('2026-01-03T12:00:00.000Z'))
    const buffer = await workbook.xlsx.writeBuffer()
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(buffer)

    expect(reopened.getWorksheet('Records')?.rowCount).toBeGreaterThan(1)
    expect(reopened.getWorksheet('Races')?.getCell('A2').value).toBe('completed')
    expect(reopened.getWorksheet('Guide')?.getCell('C2').value).toBe('1.0')
  })

  it('keeps every sheet usable before the first sync', async () => {
    const empty = data()
    empty.activities = []
    empty.athleteHistory = []
    empty.goals = []
    empty.pbs = []
    empty.plannedWorkouts = []
    empty.racePredictions = []
    empty.shoes = []
    empty.thresholdHistory = []
    empty.trainingLoadBalance = null
    empty.trainingPlan = null
    empty.trainingStatus = []
    empty.upcomingRaces = []
    empty.vo2maxHistory = { days: [], months: [] }

    const workbook = buildTrainingWorkbook(empty, new Date('2026-01-03T12:00:00.000Z'))
    const buffer = await workbook.xlsx.writeBuffer()
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(buffer)

    expect(reopened.worksheets).toHaveLength(12)
    expect(reopened.getWorksheet('Activities')?.rowCount).toBe(1)
    expect(reopened.getWorksheet('Daily Status')?.rowCount).toBe(2)
  })
})
