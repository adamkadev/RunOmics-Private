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
  })
})
