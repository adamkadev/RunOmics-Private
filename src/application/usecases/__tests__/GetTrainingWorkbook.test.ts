import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import type { CoachingPlan } from '@/domain/coaching/types'
import { buildActivitiesCsv, buildTrainingWorkbook, type TrainingWorkbookData } from '../GetTrainingWorkbook'

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
    activityNotes: new Map(),
    notesAvailable: true,
    athlete: { displayName: 'Runner', age: 35, restingHrBpm: 45, maxHrBpm: 190 },
    athleteHistory: [{ date: '2026-01-01', weightKg: 70 }],
    coachingPlans: [],
    goals: [{ year: 2026, annualDistanceKm: 1000, targets: [{ distance: '10K', targetSeconds: 2600 }] }],
    pbs: [{ year: 2026, entries: [{ distance: '10K', seconds: 2700, activityId: 'race-1' }] }],
    plannedWorkouts: [{ date: '2026-01-02', name: 'Recovery run', type: 'Base', durationSecs: 1800 }],
    racePredictions: [{ date: '2026-01-02', '5k': 1250, '10k': 2600, half: 5900, marathon: 12500 }],
    raceResults: [],
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
      'Guide', 'Athlete', 'Context', 'Activities', 'Intervals', 'Daily Status', 'Records', 'Races', 'Training Plan',
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

  it('exports each rep of a structured session with its own pace and heart rate', () => {
    const split = (type: ActivitySplit['type'], durationSec: number, distanceM: number, avgHr: number | null): ActivitySplit =>
      ({ type, durationSec, distanceM, avgSpeedMs: distanceM / durationSec, avgHr, laps: [] })
    const input = data()
    input.activities = [activity({
      id: 'threshold-1',
      description: 'Threshold · 3 × 8′ @ 4:25',
      splits: [
        split('interval_warmup', 720, 2100, 140),
        split('interval_active', 460, 1692, 167),
        split('interval_recovery', 240, 640, 150),
        split('interval_active', 460, 1751, 170),
        split('interval_recovery', 240, 640, 152),
        split('interval_active', 460, 1769, 169),
        split('interval_active', 20, 90, null),
        split('interval_cooldown', 600, 1700, 145),
      ],
    }), activity({
      id: 'easy-1',
      splits: [split('interval_active', 3000, 9000, 148)],
    }), activity({
      id: 'strides-1',
      splits: [split('interval_active', 3000, 9000, 148), split('interval_active', 20, 100, null), split('interval_recovery', 60, 150, 160)],
    })]

    const workbook = buildTrainingWorkbook(input, new Date('2026-01-03T12:00:00.000Z'))
    const activities = workbook.getWorksheet('Activities')!
    const activityColumns = headers(activities)
    const threshold = activities.getRow(2)
    expect(threshold.getCell(activityColumns.indexOf('execution_rep_paces_sec_per_km') + 1).value).toBe('272 | 263 | 260')
    expect(threshold.getCell(activityColumns.indexOf('execution_rep_avg_hr_bpm') + 1).value).toBe(169)

    const intervals = workbook.getWorksheet('Intervals')!
    const columns = headers(intervals)
    const rows = [...Array(intervals.rowCount - 1)].map((_, index) => intervals.getRow(index + 2))
    const cell = (row: ExcelJS.Row, key: string) => row.getCell(columns.indexOf(key) + 1).value

    expect(rows.map((row) => cell(row, 'activity_id'))).toEqual([...Array(8).fill('threshold-1'), ...Array(3).fill('strides-1')])
    expect(rows.map((row) => cell(row, 'segment'))).toEqual(
      ['warmup', 'rep', 'recovery', 'rep', 'recovery', 'rep', 'stride', 'cooldown', 'steady', 'stride', 'recovery'],
    )
    expect(rows.map((row) => cell(row, 'rep_index'))).toEqual([null, 1, null, 2, null, 3, 1, null, null, 1, null])
    expect(cell(rows[1]!, 'pace_sec_per_km')).toBe(272)
    expect(cell(rows[1]!, 'avg_heart_rate_bpm')).toBe(167)
  })

  it('labels the Garmin zone floors as lower bounds', () => {
    const input = data()
    input.athlete = { ...input.athlete, hrZoneBoundsBpm: [112, 140, 156, 167, 173] }
    const sheet = buildTrainingWorkbook(input, new Date('2026-01-03T12:00:00.000Z')).getWorksheet('Athlete')!
    const columns = headers(sheet)

    expect(columns).not.toContain('hr_zone_2_upper_bpm')
    expect(sheet.getRow(2).getCell(columns.indexOf('hr_zone_2_lower_bpm') + 1).value).toBe(140)
  })

  it('keeps rest days in the daily status timeline', () => {
    const workbook = buildTrainingWorkbook(data(), new Date('2026-01-03T12:00:00.000Z'))
    const sheet = workbook.getWorksheet('Daily Status')!
    const columns = headers(sheet)
    const dateIndex = columns.indexOf('date') + 1
    const activityCountIndex = columns.indexOf('actual_session_count') + 1
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
    expect(reopened.getWorksheet('Guide')?.getCell('C2').value).toBe('1.2')
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

    expect(reopened.worksheets).toHaveLength(14)
    expect(reopened.getWorksheet('Activities')?.rowCount).toBe(1)
    expect(reopened.getWorksheet('Daily Status')?.rowCount).toBe(2)
  })

  describe('coaching context', () => {
    const at = new Date('2026-01-03T12:00:00.000Z')
    function rows(sheet: ExcelJS.Worksheet): Array<Record<string, unknown>> {
      const keys = headers(sheet)
      return [...Array(sheet.rowCount - 1)].map((_, index) => {
        const row = sheet.getRow(index + 2)
        return Object.fromEntries(keys.map((key, column) => [key, row.getCell(column + 1).value]))
      })
    }

    it('merges runs saved back to back into one session and keeps a later run of the day apart', () => {
      const input = data()
      input.activities = [
        activity({ id: 'warmup', startTimeLocal: '2026-01-01T08:00:00', durationSeconds: 1200, distanceKm: 3, type: 'Tempo', avgHeartRate: 150 }),
        activity({ id: 'test', startTimeLocal: '2026-01-01T08:22:00', durationSeconds: 360, distanceKm: 1.5, type: 'Anaerobic', avgHeartRate: 185, description: 'Test VMA' }),
        activity({ id: 'evening', startTimeLocal: '2026-01-01T19:00:00', durationSeconds: 1800, distanceKm: 5 }),
      ]
      input.activityNotes = new Map([['warmup', { note: 'Windy', tags: ['test'] }], ['test', { note: '1580 m', tags: ['test'] }]])

      const workbook = buildTrainingWorkbook(input, at)
      const sessions = rows(workbook.getWorksheet('Activities')!)
      const daily = rows(workbook.getWorksheet('Daily Status')!).find((row) => (row.date as Date).toISOString().startsWith('2026-01-01'))

      expect(sessions).toHaveLength(2)
      expect(sessions[0]).toMatchObject({
        activity_id: 'test',
        merged_activity_ids: 'warmup',
        start_time_local: '08:00',
        type: 'Anaerobic',
        description: 'Test VMA',
        distance_km: 4.5,
        duration_seconds: 1560,
        avg_heart_rate_bpm: 158,
        main_run_distance_km: 1.5,
        main_run_duration_seconds: 360,
        main_run_avg_heart_rate_bpm: 185,
        comment: 'Windy / 1580 m',
        tags: 'test',
      })
      expect(sessions[1]).toMatchObject({ activity_id: 'evening', merged_activity_ids: null, main_run_distance_km: null })
      expect(daily?.actual_session_count).toBe(2)
    })

    it('puts the official result beside what the watch measured', () => {
      const input = data()
      input.raceResults = [{ activityId: 'race-1', eventName: 'Winter 10K', date: '2026-01-03', distanceMeters: 10000, chipTimeSeconds: 2690, overallPlace: 28, finisherCount: 188 }]

      const workbook = buildTrainingWorkbook(input, at)
      const race = rows(workbook.getWorksheet('Activities')!).find((row) => row.activity_id === 'race-1')
      const result = rows(workbook.getWorksheet('Races')!).find((row) => row.activity_id === 'race-1')

      expect(race).toMatchObject({ race_official_time_seconds: 2690, race_official_pace_sec_per_km: 269, race_overall_place: 28 })
      expect(result).toMatchObject({ official_time_seconds: 2690, watch_time_seconds: 2700, finisher_count: 188 })
    })

    it('sets the coach\'s prescription beside the session it planned', () => {
      const input = data()
      const provenance = { source: 'manual', trigger: 'bootstrap', createdAt: '2025-12-20T00:00:00.000Z' } as const
      const plan: CoachingPlan = {
        schemaVersion: 1, id: 'plan', revision: 1, status: 'active', provenance,
        goal: { kind: 'performance', description: 'Progress with no target race.' },
        trainingPreferences: { availableWeekdays: [0, 2, 4], runsPerWeek: 3 },
        block: { id: 'block', name: 'Threshold base', startDate: '2025-12-29', endDate: '2026-01-25', focus: 'Two threshold sessions a week.' },
        weeks: [{ id: 'week', index: 1, startDate: '2025-12-29', endDate: '2026-01-04', focus: 'First week.', workouts: [{
          id: 'workout', revision: 1, date: '2026-01-01', type: 'threshold', title: 'Threshold 3 × 8′', status: 'prescribed', provenance,
          description: 'Held between the two thresholds by heart rate.',
          blocks: [
            { kind: 'warmup', target: { durationSeconds: 900 } },
            { kind: 'repeat', repetitions: 3, steps: [
              { kind: 'effort', target: { durationSeconds: 480, paceSecPerKm: { min: 272, max: 280 }, hrBpm: { min: 156, max: 173 } } },
              { kind: 'recovery', target: { durationSeconds: 60 } },
            ] },
          ],
        }] }],
      }
      input.coachingPlans = [plan]

      const workbook = buildTrainingWorkbook(input, at)
      const session = rows(workbook.getWorksheet('Activities')!).find((row) => row.activity_id === 'activity-1')
      const context = rows(workbook.getWorksheet('Context')!)

      expect(session).toMatchObject({
        planned_workout_name: 'Threshold 3 × 8′',
        planned_type: 'Threshold',
        planned_effort_reps: 3,
        planned_effort_seconds: 480,
        planned_effort_pace_sec_per_km: '272-280',
        planned_effort_hr_bpm: '156-173',
      })
      expect(context).toContainEqual({ section: 'Availability', item: 'running_days', value: 'Tuesday, Thursday, Sunday' })
      expect(context).toContainEqual(expect.objectContaining({ section: 'Current block', item: 'Threshold base' }))
    })

    it('tells a coach about injuries and why training stopped', () => {
      const input = data()
      input.athlete = {
        ...input.athlete,
        injuryHistory: { reviewedOn: '2026-01-02', injuries: [{ site: 'right knee', year: 2025, date: '2025-12-12', weeksOut: 5, resolved: true }] },
        trainingBreaks: [{ start: '2026-01-02', end: '2026-01-02', reason: 'heat', note: '39 °C' }],
      }

      const workbook = buildTrainingWorkbook(input, at)
      const context = rows(workbook.getWorksheet('Context')!)
      const daily = rows(workbook.getWorksheet('Daily Status')!)

      expect(context).toContainEqual({ section: 'Injuries', item: '2025-12-12 right knee', value: '5 weeks out; resolved' })
      expect(context).toContainEqual({ section: 'Training breaks', item: '2026-01-02 to 2026-01-02', value: 'heat: 39 °C' })
      expect(daily.map((row) => row.training_break)).toContain('heat')
    })
  })

  describe('notes and tags', () => {
    function cell(sheet: ExcelJS.Worksheet, row: number, column: string) {
      return sheet.getRow(row).getCell(headers(sheet).indexOf(column) + 1).value
    }

    it('writes the typed note and tags, ahead of the importer\'s empty comment', () => {
      const input = data()
      input.activityNotes = new Map([['activity-1', { note: 'Sick, cut short', tags: ['sick', 'heat'] }]])

      const sheet = buildTrainingWorkbook(input, new Date('2026-01-03T12:00:00.000Z')).getWorksheet('Activities')!

      expect(cell(sheet, 2, 'comment')).toBe('Sick, cut short')
      expect(cell(sheet, 2, 'tags')).toBe('sick | heat')
      expect(cell(sheet, 2, 'notes_status')).toBe('included')
      // An activity with no note keeps what the JSON held and has no tags.
      expect(cell(sheet, 3, 'tags')).toBeNull()
    })

    it('says so on every row when the notes store could not be read', () => {
      const input = data()
      input.notesAvailable = false

      const workbook = buildTrainingWorkbook(input, new Date('2026-01-03T12:00:00.000Z'))
      const sheet = workbook.getWorksheet('Activities')!

      expect(cell(sheet, 2, 'notes_status')).toBe('unavailable')
      expect(cell(sheet, 3, 'notes_status')).toBe('unavailable')
    })
  })

  describe('buildActivitiesCsv', () => {
    function parse(withBom: string): string[][] {
      expect(withBom.startsWith('\uFEFF')).toBe(true)
      const csv = withBom.slice(1)
      const rows: string[][] = []
      let row: string[] = []
      let field = ''
      let quoted = false
      for (let i = 0; i < csv.length; i++) {
        const c = csv[i]!
        if (quoted) {
          if (c === '"' && csv[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false
          else field += c
        } else if (c === '"') quoted = true
        else if (c === ',') { row.push(field); field = '' }
        else if (c === '\r' && csv[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++ }
        else field += c
      }
      return rows
    }

    it('is the Activities sheet: same columns, one row per activity, ISO dates', () => {
      const input = data()
      const workbook = buildTrainingWorkbook(input, new Date('2026-01-03T12:00:00.000Z'))
      const rows = parse(buildActivitiesCsv(input))

      expect(rows[0]).toEqual(headers(workbook.getWorksheet('Activities')!))
      expect(rows).toHaveLength(3)
      expect(rows[1]![rows[0]!.indexOf('date')]).toBe('2026-01-01')
      expect(rows[1]![rows[0]!.indexOf('activity_id')]).toBe('activity-1')
    })

    it('quotes notes with commas, quotes and line breaks so they survive a round trip', () => {
      const input = data()
      const note = 'Left calf, "tight" after 3 km\nwalked the last 500 m'
      input.activityNotes = new Map([['activity-1', { note, tags: ['calf', 'walk'] }]])

      const rows = parse(buildActivitiesCsv(input))
      const header = rows[0]!

      expect(rows[1]![header.indexOf('comment')]).toBe(note)
      expect(rows[1]![header.indexOf('tags')]).toBe('calf | walk')
      expect(rows[1]).toHaveLength(header.length)
    })

    it('starts with a UTF-8 byte order mark, so a Mac spreadsheet keeps the accents', () => {
      const input = data()
      input.activities = [activity({ description: 'Metz Course à pied' })]
      input.activityNotes = new Map([['activity-1', { note: 'Fréquence cardiaque erronée', tags: [] }]])

      const csv = buildActivitiesCsv(input)
      const bytes = Buffer.from(csv, 'utf8')

      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
      expect(csv.match(/\uFEFF/g)).toHaveLength(1)
      expect(parse(csv)[1]).toContain('Metz Course à pied')
      expect(parse(csv)[1]).toContain('Fréquence cardiaque erronée')
    })

    it('marks every row when the notes store could not be read, and keeps raw data out', () => {
      const input = data()
      input.notesAvailable = false

      const csv = buildActivitiesCsv(input)
      const rows = parse(csv)
      const header = rows[0]!

      expect(rows.slice(1).map((row) => row[header.indexOf('notes_status')])).toEqual(['unavailable', 'unavailable'])
      expect(csv).not.toContain('private-route')
    })
  })
})
