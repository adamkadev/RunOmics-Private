import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { GarminNotFoundError } from '@/application/ports/GarminWorkoutGateway'
import { PythonGarminGateway } from '@/infrastructure/garmin/PythonGarminGateway'

/** Fails every request as sync_bridge.py relays a GarminAPIError, the status only inside the message; a gone workout is a 404. */
const FAILING_BRIDGE = `
const lines = require('readline').createInterface({ input: process.stdin })
lines.on('line', (line) => {
  const { workoutId } = JSON.parse(line)
  const status = workoutId === 'gone' ? 404 : 500
  const error = 'HTTP ' + status + ' from https://example.test/workout-service/workout/' + workoutId
  process.stdout.write(JSON.stringify({ ok: false, error, rateLimited: false }) + '\\n')
})
`

describe('PythonGarminGateway error translation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-bridge-'))
  const script = path.join(dir, 'bridge.cjs')
  fs.writeFileSync(script, FAILING_BRIDGE)
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('reports a Garmin 404 as not found, so a removal can count it as done', async () => {
    const gateway = new PythonGarminGateway(script, process.execPath)

    await expect(gateway.deleteWorkout('gone')).rejects.toBeInstanceOf(GarminNotFoundError)
    gateway.close()
  })

  it('keeps every other failure an ordinary error', async () => {
    const gateway = new PythonGarminGateway(script, process.execPath)

    const failure = await gateway.deleteWorkout('broken').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(GarminNotFoundError)
    expect((failure as Error).message).toMatch(/^HTTP 500 from/)
    gateway.close()
  })
})

/** Real processes, not a mock: what matters is *when* Node reports a failed spawn, and a mock rejects synchronously. */
describe('PythonGarminGateway failure reporting', () => {
  it('rejects the pending call when the interpreter does not exist', async () => {
    const gateway = new PythonGarminGateway('scripts/garmin/sync_bridge.py', 'definitely-not-an-interpreter')

    await expect(gateway.getWorkout('1')).rejects.toThrow(/Could not start the Garmin bridge/)
    gateway.close()
  })

  it('names the interpreter it tried, so the fix is obvious', async () => {
    const gateway = new PythonGarminGateway('scripts/garmin/sync_bridge.py', 'python-from-2009')

    await expect(gateway.getWorkout('1')).rejects.toThrow(/python-from-2009/)
    gateway.close()
  })

  it('reports a bridge that starts and then dies, instead of "closed before answering"', async () => {
    // The realistic version is an interpreter that fails on import: stdout
    // opens, nothing is written, the process exits non-zero.
    const UNUSED_SCRIPT = '-c'
    const INTERPRETER_THAT_EXITS_NONZERO = 'false'
    const gateway = new PythonGarminGateway(UNUSED_SCRIPT, INTERPRETER_THAT_EXITS_NONZERO)

    await expect(gateway.getWorkout('1')).rejects.toThrow(/exited with code 1/)
    gateway.close()
  })
})
