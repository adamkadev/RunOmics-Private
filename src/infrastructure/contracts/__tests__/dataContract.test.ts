import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkDataDirectory } from '../dataContract'
import { writeDemoDataset } from '../../../../scripts/generate_demo_data.mjs'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-contract-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function write(relative: string, value: unknown) {
  const file = path.join(dir, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))
}

const activity = (overrides: Record<string, unknown> = {}) => ({
  id: '1', week: 202637, date: '2026-09-10', dayOfWeek: 'Thursday', type: 'Base', description: 'Easy',
  comment: '', durationSeconds: 1800, distanceKm: 5, paceSecPerKm: 360, hrZones: [], avgHeartRate: 140,
  rpe: null, polyline: null, route: [[6.1, 49.6], [6.2, 49.7]], splits: null, bestEfforts: null, weather: null,
  ...overrides,
})

function activities(...records: Record<string, unknown>[]) {
  write('activities/index.json', { months: ['2026-09'] })
  write('activities/2026-09.json', { activities: records })
}

const errors = () => checkDataDirectory(dir).filter((p) => p.severity === 'error')
const warnings = () => checkDataDirectory(dir).filter((p) => p.severity === 'warning')

describe('the data contract', () => {
  it('accepts the demo dataset the generator writes', () => {
    writeDemoDataset(dir)
    expect(checkDataDirectory(dir)).toEqual([])
  })

  it('accepts an empty workspace - a fresh deployment has no data yet', () => {
    expect(checkDataDirectory(dir)).toEqual([])
  })

  it('accepts a minimal activity', () => {
    activities(activity())
    expect(checkDataDirectory(dir)).toEqual([])
  })

  it('refuses an activity the pages cannot key or place', () => {
    activities(activity({ id: '' }), activity({ id: '2', date: '10/09/2026' }))
    expect(errors().map((p) => p.path)).toEqual(['$.activities[0].id', '$.activities[1].date'])
  })

  it('refuses an activity filed under the wrong month, and a duplicate id', () => {
    activities(activity({ date: '2026-08-31' }), activity({ id: '2' }), activity({ id: '2', date: '2026-09-11' }))
    expect(errors().map((p) => p.message)).toEqual([
      '2026-08-31 is filed under 2026-09',
      'duplicate id 2, also in activities/2026-09.json',
    ])
  })

  it('refuses a route point that is not [lon, lat]', () => {
    activities(activity({ route: [[6.1, 49.6], [49.6]] }), activity({ id: '2', route: [[200, 49.6], [6.2, 49.7]] }))
    expect(errors().map((p) => p.path)).toEqual(['$.activities[0].route[1]', '$.activities[1].route[0]'])
  })

  it('only warns on an activity type the app does not know - it renders with the Base style', () => {
    activities(activity({ type: 'Recovery' }))
    expect(errors()).toEqual([])
    expect(warnings()).toEqual([expect.objectContaining({ path: '$.activities[0].type' })])
  })

  it('only warns on a metric of the wrong type - it renders blank, not broken', () => {
    activities(activity({ avgHeartRate: '140', hrSamples: [1, 'x'] }))
    expect(errors()).toEqual([])
    expect(warnings().map((p) => p.path)).toEqual(['$.activities[0].avgHeartRate', '$.activities[0].hrSamples'])
  })

  it('refuses an index that lists a month with no file, and a file that is not JSON', () => {
    write('activities/index.json', { months: ['2026-09', '2026-08'] })
    write('activities/2026-09.json', '{"activities": [')
    expect(errors().map((p) => `${p.file}: ${p.message}`)).toEqual([
      expect.stringMatching(/^activities\/2026-09\.json: unreadable/),
      'activities/2026-08.json: listed in index.json but missing',
    ])
  })

  it('refuses the goal and record shapes the repositories map over', () => {
    write('goals.json', { years: [{ year: 2026, annualDistanceKm: 1500, targets: 'fast' }] })
    write('pbs.json', { years: [{ year: 2026, entries: [{ distance: '5K' }] }] })
    expect(errors().map((p) => `${p.file} ${p.path}`)).toEqual([
      'goals.json $.years[0].targets',
      'pbs.json $.years[0].entries[0]',
    ])
  })

  it('refuses heart-rate zone bounds the zone tables cannot split', () => {
    write('athlete.json', { hrZoneBoundsBpm: [142, 158, 168, 177] })
    expect(errors()).toEqual([expect.objectContaining({ file: 'athlete.json', path: '$.hrZoneBoundsBpm' })])
  })

  it('refuses a cross-training session the lists cannot key or place, and only warns on its figures', () => {
    write('cross_training/2026.json', {
      sessions: [
        { id: '7', date: '2026-09-10', sport: 'strength_training', durationSeconds: 2400, distanceKm: null, avgHeartRate: '98', trainingLoad: null },
        { id: '', date: '2025-12-31', sport: 'cycling', durationSeconds: 3600 },
      ],
    })
    expect(errors().map((p) => p.path)).toEqual(['$.sessions[1].id', '$.sessions[1].date'])
    expect(warnings().map((p) => p.path)).toEqual(['$.sessions[0].avgHeartRate'])
  })

  it('checks every planned-workouts year file, and names it', () => {
    write('planned_workouts/2026.json', { planned: [{ date: '2026-09-10', name: 'Easy' }, { name: 'No date' }] })
    expect(errors()).toEqual([expect.objectContaining({ file: 'planned_workouts/2026.json', path: '$.planned[1].date' })])
  })
})
