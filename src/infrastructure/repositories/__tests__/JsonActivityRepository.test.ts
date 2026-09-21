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
})
