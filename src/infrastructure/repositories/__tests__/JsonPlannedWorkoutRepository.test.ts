import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAllPlannedWorkouts } from '../JsonPlannedWorkoutRepository'

describe('getAllPlannedWorkouts', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planned-workouts-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('flattens and sorts entries across multiple year files ascending by date', () => {
    fs.writeFileSync(
      path.join(dir, '2026.json'),
      JSON.stringify({ planned: [{ date: '2026-07-18', name: 'Seuil' }] })
    )
    fs.writeFileSync(
      path.join(dir, '2025.json'),
      JSON.stringify({ planned: [{ date: '2025-12-01', name: 'Footing' }] })
    )

    const planned = getAllPlannedWorkouts(dir)

    expect(planned.map((p) => p.date)).toEqual(['2025-12-01', '2026-07-18'])
  })

  it('excludes index.json', () => {
    fs.writeFileSync(
      path.join(dir, '2026.json'),
      JSON.stringify({ planned: [{ date: '2026-07-18', name: 'Seuil' }] })
    )
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ years: ['2026'] }))

    const planned = getAllPlannedWorkouts(dir)

    expect(planned).toHaveLength(1)
  })

  it('returns an empty array when the directory does not exist', () => {
    expect(getAllPlannedWorkouts(path.join(dir, 'missing'))).toEqual([])
  })
})
