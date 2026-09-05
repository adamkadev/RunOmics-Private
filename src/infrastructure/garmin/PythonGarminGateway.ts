import { spawn, type ChildProcessByStdio } from 'child_process'
import type { Readable, Writable } from 'stream'
import readline from 'readline'
import { GarminRateLimitError, type GarminWorkoutGateway } from '@/application/ports/GarminWorkoutGateway'
import type { GarminWorkoutPayload } from '@/application/coaching/garminWorkoutMapping'

/** stderr is inherited so Python tracebacks reach the operator's terminal directly. */
type BridgeProcess = ChildProcessByStdio<Writable, Readable, null>

/**
 * Garmin transport for the coaching sync.
 *
 * The authenticated Garmin session lives in Python (scripts/garmin/client.py,
 * the one the whole sync pipeline already uses), so this gateway does not
 * authenticate at all: it runs scripts/garmin/sync_bridge.py as a long-lived
 * child and speaks newline-delimited JSON to it. GARMIN_SECRET is inherited by
 * the child from the environment and never read, logged or passed on the
 * command line here.
 */

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
  /** Requests are serialised: the bridge answers in order, one line per line. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly scriptPath = 'scripts/garmin/sync_bridge.py',
    private readonly python = process.env.RUNOMICS_PYTHON?.trim() || 'python3',
  ) {}

  private start(): { child: BridgeProcess; lines: AsyncIterator<string> } {
    if (this.child && this.lines) return { child: this.child, lines: this.lines }

    const child = spawn(this.python, [this.scriptPath], { stdio: ['pipe', 'pipe', 'inherit'] })
    child.on('error', (error) => {
      throw new Error(`Could not start the Garmin bridge (${this.python}): ${error.message}`)
    })
    this.child = child
    this.lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]()
    return { child, lines: this.lines }
  }

  private send(request: Record<string, unknown>): Promise<BridgeResponse> {
    const run = this.queue.then(async () => {
      const { child, lines } = this.start()
      child.stdin.write(`${JSON.stringify(request)}\n`)
      const next = await lines.next()
      if (next.done) throw new Error('The Garmin bridge closed before answering')

      const response = JSON.parse(next.value) as BridgeResponse
      if (!response.ok) {
        if (response.rateLimited) throw new GarminRateLimitError(response.error)
        throw new Error(response.error ?? 'The Garmin bridge reported an unspecified failure')
      }
      return response
    })
    // Keep the chain alive after a rejection so later operations still run in order.
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
  }
}
