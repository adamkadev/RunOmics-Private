import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const SYNC_SOURCES = [
  'src/application/coaching/intervalsSync.ts',
  'src/application/coaching/intervalsSyncState.ts',
  'src/application/coaching/intervalsWorkoutEncoding.ts',
  'src/application/coaching/syncRoute.ts',
  'src/application/ports/IntervalsCalendarGateway.ts',
  'src/infrastructure/intervals/HttpIntervalsGateway.ts',
  'src/infrastructure/repositories/JsonIntervalsSyncStore.ts',
  'scripts/coachingSyncIntervals.ts',
]

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf-8')

describe('intervals.icu sync keeps athlete data out of this repository', () => {
  it.each(SYNC_SOURCES)('%s contains no intervals.icu athlete id literal', (file) => {
    expect(read(file)).not.toMatch(/\bi\d{4,}\b/)
  })

  it('never defaults the state file into this repository', () => {
    const store = read('src/infrastructure/repositories/JsonIntervalsSyncStore.ts')

    expect(store).toContain('dataPath')
    expect(store).not.toMatch(/process\.cwd\(\)/)
  })

  it('never logs from the gateway', () => {
    expect(read('src/infrastructure/intervals/HttpIntervalsGateway.ts')).not.toMatch(/console\.(log|error|warn)/)
  })

  it('reads the API key from the environment only', () => {
    const script = read('scripts/coachingSyncIntervals.ts')

    expect(script).toContain('process.env.INTERVALS_API_KEY')
    expect(script).not.toMatch(/INTERVALS_API_KEY\s*}/)
  })
})
