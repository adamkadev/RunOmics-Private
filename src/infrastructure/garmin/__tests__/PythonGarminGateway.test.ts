import { describe, expect, it } from 'vitest'
import { PythonGarminGateway } from '@/infrastructure/garmin/PythonGarminGateway'

/**
 * Real processes, not a `child_process` mock: the bug is about *when* Node
 * reports a failed spawn, and a mock that rejects synchronously would pass
 * against the broken code.
 */
describe('PythonGarminGateway failure reporting', () => {
  it('rejects the pending call when the interpreter does not exist', async () => {
    const gateway = new PythonGarminGateway('scripts/garmin/sync_bridge.py', 'definitely-not-an-interpreter')

    // Before: the 'error' listener threw, which no promise was watching, so
    // this took the process down instead of rejecting.
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
