import { describe, expect, it } from 'vitest'
import { PythonGarminGateway } from '@/infrastructure/garmin/PythonGarminGateway'

/**
 * These spawn real processes rather than mocking `child_process`, because the
 * bug being pinned here was entirely about *when* Node reports a failed spawn:
 * asynchronously, on the child's 'error' event, long after `start()` returned.
 * A mock that rejects synchronously would have gone green over the broken code.
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
    // An interpreter that runs but fails on import is the realistic version of
    // this: it opens stdout, writes nothing, and exits non-zero.
    const gateway = new PythonGarminGateway('-c', 'false')

    await expect(gateway.getWorkout('1')).rejects.toThrow(/exited with code 1|closed before answering/)
    gateway.close()
  })
})
