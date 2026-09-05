import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

/**
 * The Garmin sync is shared code; the ids it manipulates belong to one athlete.
 * These guards keep that separation from eroding: nothing under src/ or
 * scripts/ may name a real Garmin workout, a real schedule entry, or a real
 * coaching plan, and no default may point the mapping file at this repository.
 */

const SYNC_SOURCES = [
  'src/application/coaching/garminSync.ts',
  'src/application/coaching/garminSyncApply.ts',
  'src/application/coaching/garminSyncState.ts',
  'src/application/coaching/garminWorkoutMapping.ts',
  'src/application/ports/GarminWorkoutGateway.ts',
  'src/infrastructure/garmin/PythonGarminGateway.ts',
  'src/infrastructure/repositories/JsonGarminSyncStore.ts',
  'scripts/coaching-sync-garmin.ts',
  'scripts/garmin/sync_bridge.py',
]

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf-8')

describe('athlete data stays out of this repository', () => {
  it.each(SYNC_SOURCES)('%s contains no Garmin id literal', (file) => {
    const source = read(file)
    // Garmin workout and schedule ids are 9-11 digit numbers; the sync code has
    // no reason to name one. Type ids and dates are far shorter.
    expect(source.match(/\b\d{9,}\b/g)).toBeNull()
  })

  it.each(SYNC_SOURCES)('%s contains no coaching plan UUID', (file) => {
    expect(read(file)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })

  it('never defaults the mapping file into this repository', () => {
    const store = read('src/infrastructure/repositories/JsonGarminSyncStore.ts')

    expect(store).toContain('dataPath')
    expect(store).not.toMatch(/process\.cwd\(\)/)
  })

  it('reads the Garmin token from the environment only', () => {
    const bridge = read('scripts/garmin/sync_bridge.py')

    expect(bridge).toContain('os.environ.get("GARMIN_SECRET"')
    // No credential handling and no second login flow.
    expect(bridge).not.toMatch(/garth\.login|password|getpass/)
  })

  it('never logs the Garmin token from the gateway', () => {
    const gateway = read('src/infrastructure/garmin/PythonGarminGateway.ts')

    expect(gateway).not.toMatch(/GARMIN_SECRET\s*[)\]]?\s*[,)]?\s*$/m)
    expect(gateway).not.toMatch(/console\.(log|error|warn)/)
  })
})
