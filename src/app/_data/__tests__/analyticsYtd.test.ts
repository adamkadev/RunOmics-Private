import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyticsYtd } from '../analyticsYtd'

const roots: string[] = []

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('the year to date as Analytics reads it', () => {
  it('totals the runs when there are no goals, PBs or races', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-ytd-'))
    roots.push(root)
    fs.cpSync(path.join(process.cwd(), 'data'), root, { recursive: true })
    for (const file of ['goals.json', 'pbs.json', 'upcoming_races.json']) fs.rmSync(path.join(root, file), { force: true })
    vi.stubEnv('RUNOMICS_DATA_DIR', root)
    const { getActivitySummaries } = await import('@/application/usecases/GetActivities')
    const { getGoalsPageData } = await import('@/application/usecases/GetGoalsData')
    const activities = getActivitySummaries()
    const today = activities[0]!.date.slice(0, 10)
    const year = Number(today.slice(0, 4))
    const goals = await getGoalsPageData(today)

    const ytd = analyticsYtd(activities, goals.byYear[year] ?? null, today)

    expect(goals.byYear[year]).toBeUndefined()
    expect(ytd.km).toBeGreaterThan(0)
    expect(ytd.goalKm).toBeNull()
    expect(ytd.projection).toBeNull()
  })

  it('counts the runs from 1 January even before Goals has the new year', () => {
    const runs = [{ date: '2026-12-30', distanceKm: 10 }, { date: '2027-01-01', distanceKm: 8.4 }, { date: '2027-01-02', distanceKm: 5 }]
    expect(analyticsYtd(runs, null, '2027-01-02')).toMatchObject({ km: 13, goalKm: null, projection: null })
  })
})
