import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAllActivities } from '../JsonActivityRepository'

describe('getAllActivities', () => {
  let dir: string

  const writeMonth = (month: string, dates: string[]) =>
    fs.writeFileSync(
      path.join(dir, `${month}.json`),
      JSON.stringify({ activities: dates.map((date) => ({ id: date, date })) })
    )

  const writeIndex = (months: string[]) =>
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ months }))

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'activities-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('flattens the months listed in index.json, newest first', () => {
    writeMonth('2026-06', ['2026-06-02'])
    writeMonth('2026-07', ['2026-07-05', '2026-07-01'])
    writeIndex(['2026-07', '2026-06'])

    expect(getAllActivities(dir).map((a) => a.date)).toEqual(['2026-07-05', '2026-07-01', '2026-06-02'])
  })

  it('ignores a stale month file that index.json no longer lists', () => {
    writeMonth('2026-07', ['2026-07-05'])
    writeMonth('2026-07-old', ['2026-07-05'])
    writeIndex(['2026-07'])

    expect(getAllActivities(dir)).toHaveLength(1)
  })

  describe('without an explicit directory', () => {
    const original = process.env.RUNOMICS_DATA_DIR

    afterEach(() => {
      if (original === undefined) delete process.env.RUNOMICS_DATA_DIR
      else process.env.RUNOMICS_DATA_DIR = original
    })

    it('reads the workspace configured at call time, and each workspace once', () => {
      const workspace = (date: string) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'activities-root-'))
        const activities = path.join(root, 'activities')
        fs.mkdirSync(activities)
        fs.writeFileSync(path.join(activities, 'index.json'), JSON.stringify({ months: ['2026-07'] }))
        fs.writeFileSync(path.join(activities, '2026-07.json'), JSON.stringify({ activities: [{ id: date, date }] }))
        return root
      }
      const first = workspace('2026-07-01')
      const second = workspace('2026-07-02')

      try {
        process.env.RUNOMICS_DATA_DIR = first
        expect(getAllActivities().map((a) => a.date)).toEqual(['2026-07-01'])

        // Still the cached read: the index is the dataset, loaded once.
        fs.writeFileSync(path.join(first, 'activities', '2026-07.json'), JSON.stringify({ activities: [] }))
        expect(getAllActivities()).toHaveLength(1)

        process.env.RUNOMICS_DATA_DIR = second
        expect(getAllActivities().map((a) => a.date)).toEqual(['2026-07-02'])
      } finally {
        fs.rmSync(first, { recursive: true, force: true })
        fs.rmSync(second, { recursive: true, force: true })
      }
    })

    it('drops the heart rate of runs before hrReliableFrom and of runs the owner marked unreliable', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'activities-root-'))
      const run = (id: string, date: string) => ({ id, date, avgHeartRate: 150, hrZones: [{ zone: 2, seconds: 60 }], hrSamples: [150], splits: null })
      fs.mkdirSync(path.join(root, 'activities'))
      fs.writeFileSync(path.join(root, 'activities', 'index.json'), JSON.stringify({ months: ['2026-10'] }))
      fs.writeFileSync(path.join(root, 'activities', '2026-10.json'), JSON.stringify({
        activities: [run('old', '2026-10-10'), run('marked', '2026-10-20'), run('kept', '2026-10-21')],
      }))
      fs.writeFileSync(path.join(root, 'athlete.json'), JSON.stringify({ hrReliableFrom: '2026-10-16' }))
      fs.writeFileSync(path.join(root, 'activity_notes.json'), JSON.stringify({ notes: { marked: { note: '', tags: [], hrUnreliable: true } } }))

      try {
        process.env.RUNOMICS_DATA_DIR = root
        const byId = new Map(getAllActivities().map((a) => [a.id, a]))

        expect(byId.get('old')).toMatchObject({ avgHeartRate: null, hrZones: [], hrSamples: null, hrUntrusted: 'beforeReliable' })
        expect(byId.get('marked')).toMatchObject({ avgHeartRate: null, hrUntrusted: 'marked' })
        expect(byId.get('kept')).toMatchObject({ avgHeartRate: 150, hrSamples: [150] })
        expect(byId.get('kept')).not.toHaveProperty('hrUntrusted')
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })

    it('counts each run toward the shoe the owner picked, and a run Garmin gave none toward the default shoe', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'activities-root-'))
      fs.mkdirSync(path.join(root, 'activities'))
      fs.writeFileSync(path.join(root, 'activities', 'index.json'), JSON.stringify({ months: ['2026-10'] }))
      fs.writeFileSync(path.join(root, 'activities', '2026-10.json'), JSON.stringify({
        activities: [{ id: 'picked', date: '2026-10-20', gearId: 'b' }, { id: 'bare', date: '2026-10-21', gearId: null }],
      }))
      const shoe = (gearId: string) => ({ gearId, brand: 'Brand', model: gearId, maxKm: 800, retired: false, firstUseDate: null })
      fs.writeFileSync(path.join(root, 'shoes.json'), JSON.stringify({ shoes: [shoe('a'), shoe('b')] }))
      fs.writeFileSync(path.join(root, 'shoe_choices.json'), JSON.stringify({
        runs: { picked: { gearId: 'a' } },
        settings: { default: { gearId: 'b' } },
      }))

      try {
        process.env.RUNOMICS_DATA_DIR = root
        const byId = new Map(getAllActivities().map((a) => [a.id, a]))

        expect(byId.get('picked')).toMatchObject({ gearId: 'a', gearSource: 'choice' })
        expect(byId.get('bare')).toMatchObject({ gearId: 'b', gearSource: 'default' })
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })
  })
})
