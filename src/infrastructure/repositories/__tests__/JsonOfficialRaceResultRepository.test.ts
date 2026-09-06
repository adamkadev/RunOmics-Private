import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { getOfficialRaceResults } from '../JsonOfficialRaceResultRepository'

const tempDirs: string[] = []

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-race-results-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('getOfficialRaceResults', () => {
  it('returns an empty overlay when no index exists', () => {
    expect(getOfficialRaceResults(tempDir())).toEqual([])
  })

  it('reads activity-id keyed shards without touching Garmin activity data', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ activityIds: ['24249913094'] }))
    fs.writeFileSync(path.join(dir, '24249913094.json'), JSON.stringify({
      activityId: '24249913094',
      eventName: 'Escher Kulturlaf',
      date: '2026-09-05',
      distanceMeters: 5000,
      chipTimeSeconds: 1292,
      gunTimeSeconds: 1293,
      overallPlace: 28,
      source: 'official-results',
    }))

    expect(getOfficialRaceResults(dir)).toEqual([{
      activityId: '24249913094',
      eventName: 'Escher Kulturlaf',
      date: '2026-09-05',
      distanceMeters: 5000,
      chipTimeSeconds: 1292,
      gunTimeSeconds: 1293,
      overallPlace: 28,
      source: 'official-results',
    }])
  })
})
