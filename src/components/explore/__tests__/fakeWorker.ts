import type { ExploreRequest, ExploreResponse } from '../workerProtocol'

/** Replies come from `respond`, on a later task as a real worker's would, or from the test calling `reply` itself. */
export class FakeWorker {
  posted: { message: ExploreRequest; transfer: Transferable[] }[] = []
  terminated = false
  private listeners = new Map<string, ((event: unknown) => void)[]>()

  constructor(private respond?: (message: ExploreRequest, transfer: Transferable[]) => ExploreResponse | Promise<ExploreResponse> | null) {}

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  postMessage(message: ExploreRequest, transfer: Transferable[] = []): void {
    this.posted.push({ message, transfer })
    const answer = this.respond?.(message, transfer)
    if (answer) setTimeout(() => void Promise.resolve(answer).then((data) => this.reply(data)), 0)
  }

  reply(data: ExploreResponse): void {
    this.emit('message', { data })
  }

  fail(message: string): void {
    this.emit('error', { message })
  }

  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  terminate(): void {
    this.terminated = true
  }

  /** Posted messages of one type. */
  sent(type: ExploreRequest['type']): ExploreRequest[] {
    return this.posted.map((p) => p.message).filter((m) => m.type === type)
  }
}

/** Lets pending timers and promise chains run, a few tasks deep. */
export async function flush(rounds = 5): Promise<void> {
  for (let k = 0; k < rounds; k++) await new Promise((resolve) => setTimeout(resolve, 0))
}
