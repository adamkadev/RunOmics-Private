import type { IntervalsWorkoutEvent } from '@/application/coaching/intervalsWorkoutEncoding'

export interface IntervalsEventRecord {
  id: string
  externalId: string | null
  date: string
  name: string
}

export interface IntervalsCalendarGateway {
  /** Null when intervals.icu has no such event. */
  getEvent(eventId: string): Promise<IntervalsEventRecord | null>
  createEvent(event: IntervalsWorkoutEvent): Promise<IntervalsEventRecord>
  /** Throws IntervalsNotFoundError when the event is gone. */
  updateEvent(eventId: string, event: IntervalsWorkoutEvent): Promise<IntervalsEventRecord>
  /** Throws IntervalsNotFoundError when the event is gone. */
  deleteEvent(eventId: string): Promise<void>
  listWorkoutEvents(oldest: string, newest: string): Promise<IntervalsEventRecord[]>
}

export class IntervalsRateLimitError extends Error {
  constructor(message = 'intervals.icu rate limited the request') {
    super(message)
    this.name = 'IntervalsRateLimitError'
  }
}

export class IntervalsNotFoundError extends Error {
  constructor(message = 'intervals.icu has no such event') {
    super(message)
    this.name = 'IntervalsNotFoundError'
  }
}
