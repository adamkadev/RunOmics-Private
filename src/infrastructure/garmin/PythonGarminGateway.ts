import { spawn, type ChildProcessByStdio } from 'child_process'
import type { Readable, Writable } from 'stream'
import readline from 'readline'
import { GarminRateLimitError, type GarminWorkoutGateway } from '@/application/ports/GarminWorkoutGateway'
import type { GarminWorkoutPayload } from '@/application/coaching/garminWorkoutMapping'

type BridgeProcess = ChildProcessByStdio<Writable, Readable, null>

interface BridgeResponse {
  ok: boolean
  error?: string
  rateLimited?: boolean
  workoutId?: string
  workoutScheduleId?: string
  workout?: { workoutId: string; workoutName: string } | null
  items?: { scheduleId: string; workoutId: string; date: string }[]
}

export class PythonGarminGateway implements GarminWorkoutGateway {
  private child: BridgeProcess | null = null
  private lines: AsyncIterator<string> | null = null
  private queue: Promise<unknown> = Promise.resolve()

  /**
   * Settles only if the bridge dies, and only ever by rejecting.
   *
   * `spawn` reports a missing interpreter asynchronously, on the child's
   * 'error' event - long after `start()` has returned. Throwing from inside
   * that listener rejects nothing: it escapes into the event loop as an
   * uncaught exception and takes the whole CLI down, so "python3 is not
   * installed" reached the operator as a stack trace that never mentioned
   * Garmin. Nor is closing stdout enough to unblock the reader - readline's
   * async iterator does not finish on a destroyed input, so the pending
   * `lines.next()` simply hangs forever.
   *
   * So the death of the bridge is a promise in its own right, and every read
   * races the answer against it.
   */
  private died: Promise<never> | null = null

  constructor(
    private readonly scriptPath = 'scripts/garmin/sync_bridge.py',
    private readonly python = process.env.RUNOMICS_PYTHON?.trim() || 'python3',
  ) {}

  private start(): { child: BridgeProcess; lines: AsyncIterator<string>; died: Promise<never> } {
    if (this.child && this.lines && this.died) {
      return { child: this.child, lines: this.lines, died: this.died }
    }

    const child = spawn(this.python, [this.scriptPath], { stdio: ['pipe', 'pipe', 'inherit'] })

    this.died = new Promise<never>((_, reject) => {
      child.on('error', (error) => {
        reject(new Error(`Could not start the Garmin bridge (${this.python}): ${error.message}`))
      })
      // An interpreter that starts and then dies - a missing dependency, a
      // traceback on import - used to surface only as "closed before
      // answering", which reads like a Garmin problem rather than a local one.
      child.on('exit', (code, signal) => {
        if (code === 0) return
        reject(
          new Error(
            `The Garmin bridge exited ${signal ? `on ${signal}` : `with code ${code}`} - see its output above.`
          )
        )
      })
    })
    // The rejection is consumed by whichever read races it. Claiming it here
    // too keeps a failure with no read in flight from being reported as an
    // unhandled rejection.
    this.died.catch(() => {})

    // Writing to the stdin of a process that never started raises EPIPE on the
    // stream, and an unhandled 'error' on a stream is fatal. The death promise
    // is already carrying the real diagnosis.
    child.stdin.on('error', () => {})

    this.child = child
    this.lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]()
    return { child, lines: this.lines, died: this.died }
  }

  private send(request: Record<string, unknown>): Promise<BridgeResponse> {
    const run = this.queue.then(async () => {
      const { child, lines, died } = this.start()
      child.stdin.write(`${JSON.stringify(request)}\n`)

      const next = await Promise.race([lines.next(), died])
      if (next.done) throw new Error('The Garmin bridge closed before answering')

      const response = JSON.parse(next.value) as BridgeResponse
      if (!response.ok) {
        if (response.rateLimited) throw new GarminRateLimitError(response.error)
        throw new Error(response.error ?? 'The Garmin bridge reported an unspecified failure')
      }
      return response
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  async createWorkout(payload: GarminWorkoutPayload): Promise<{ workoutId: string }> {
    const response = await this.send({ op: 'create', payload })
    return { workoutId: response.workoutId as string }
  }

  async scheduleWorkout(workoutId: string, date: string): Promise<{ workoutScheduleId: string }> {
    const response = await this.send({ op: 'schedule', workoutId, date })
    return { workoutScheduleId: response.workoutScheduleId as string }
  }

  async unscheduleWorkout(scheduleId: string): Promise<void> {
    await this.send({ op: 'unschedule', scheduleId })
  }

  async deleteWorkout(workoutId: string): Promise<void> {
    await this.send({ op: 'delete', workoutId })
  }

  async getWorkout(workoutId: string): Promise<{ workoutId: string; workoutName: string } | null> {
    const response = await this.send({ op: 'get', workoutId })
    return response.workout ?? null
  }

  async getScheduledWorkouts(year: number, month: number): Promise<{ scheduleId: string; workoutId: string; date: string }[]> {
    const response = await this.send({ op: 'scheduled', year, month })
    return response.items ?? []
  }

  close(): void {
    this.child?.stdin.end()
    this.child = null
    this.lines = null
    this.died = null
  }
}
