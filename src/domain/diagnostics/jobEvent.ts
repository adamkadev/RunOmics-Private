export const JOB_TRIGGERS = ['cron', 'manual', 'sync'] as const
export type JobTrigger = (typeof JOB_TRIGGERS)[number]

export const JOB_OUTCOMES = ['sent', 'skipped', 'error'] as const
export type JobOutcome = (typeof JOB_OUTCOMES)[number]

/** One run of an internal route. Names and codes only: no token, message or body, so nothing private is ever kept. */
export interface JobEvent {
  /** ISO time, the server's. */
  at: string
  route: string
  trigger: JobTrigger
  outcome: JobOutcome
  status: number
  /** The thrown error's class name ("TypeError"), when the handler threw. */
  error?: string
}

export function jobOutcome(status: number, body: unknown): JobOutcome {
  if (status >= 500) return 'error'
  if (typeof body !== 'object' || body === null) return 'sent'
  const { skipped, sent } = body as Record<string, unknown>
  return skipped !== undefined || sent === false ? 'skipped' : 'sent'
}

/** A class name and nothing else: a custom error's name could otherwise carry a message. */
export function errorName(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name
  return typeof name === 'string' && /^[A-Za-z][\w]{0,39}$/.test(name) ? name : 'Error'
}

/** Newest first in, one per route out: the latest run of each, newest first. */
export function latestPerRoute(events: readonly JobEvent[]): JobEvent[] {
  const seen = new Set<string>()
  return events.filter((event) => !seen.has(event.route) && seen.add(event.route))
}

export function failedSince(events: readonly JobEvent[], lastAt: string | null): JobEvent[] {
  return lastAt === null ? [] : events.filter((event) => event.outcome === 'error' && event.at > lastAt)
}

/** About a month of the six daily and weekly crons, so a weekly job's last run is still there. */
export const JOB_EVENTS_KEPT = 200
