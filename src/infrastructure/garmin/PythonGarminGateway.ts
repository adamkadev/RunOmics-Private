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

interface Bridge {
  child: BridgeProcess
  lines: AsyncIterator<string>
  /**
   * `spawn` reports a missing interpreter asynchronously, and readline's async
   * iterator never ends on a destroyed stdin - so a dead bridge is something
   * every read has to race, not something a listener can throw out of.
   */
  died: Promise<never>
  /** Resolves when the child exits: its error if the code was non-zero, else null. */
  ended: Promise<Error | null>
}

export class PythonGarminGateway implements GarminWorkoutGateway {
  private bridge: Bridge | null = null
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly scriptPath = 'scripts/garmin/sync_bridge.py',
    // Windows has no python3 on PATH - the name resolves to a Microsoft Store
    // stub that exits 9009, which surfaces as every workout failing at once.
    private readonly python = process.env.RUNOMICS_PYTHON?.trim()
      || (process.platform === 'win32' ? 'python' : 'python3'),
  ) {}

  private start(): Bridge {
    if (this.bridge) return this.bridge

    const child = spawn(this.python, [this.scriptPath], { stdio: ['pipe', 'pipe', 'inherit'] })

    let announceExit: (error: Error | null) => void = () => {}
    const ended = new Promise<Error | null>((resolve) => {
      announceExit = resolve
    })

    const died = new Promise<never>((_, reject) => {
      child.on('error', (error) => {
        const failure = new Error(`Could not start the Garmin bridge (${this.python}): ${error.message}`)
        announceExit(failure)
        reject(failure)
      })
      child.on('exit', (code, signal) => {
        if (code === 0) {
          announceExit(null)
          return
        }
        const failure = new Error(
          `The Garmin bridge exited ${signal ? `on ${signal}` : `with code ${code}`} - see its output above.`
        )
        announceExit(failure)
        reject(failure)
      })
    })
    // Both swallow-handlers exist so a failure with no read in flight is not an
    // unhandled rejection, and an EPIPE write is not a fatal stream error.
    died.catch(() => {})
    child.stdin.on('error', () => {})

    const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]()
    this.bridge = { child, lines, died, ended }
    return this.bridge
  }

  private send(request: Record<string, unknown>): Promise<BridgeResponse> {
    const run = this.queue.then(async () => {
      const { child, lines, died, ended } = this.start()
      child.stdin.write(`${JSON.stringify(request)}\n`)

      const next = await Promise.race([lines.next(), died.catch((error: Error) => error)])
      if (next instanceof Error) throw next
      // stdout closing can beat the 'exit' event, so wait for the real reason
      // rather than racing it.
      if (next.done) throw (await ended) ?? new Error('The Garmin bridge closed before answering')

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
    this.bridge?.child.stdin.end()
    this.bridge = null
  }
}
