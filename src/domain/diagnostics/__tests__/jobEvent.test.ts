import { describe, expect, it } from 'vitest'
import { errorName, failedSince, jobOutcome, latestPerRoute, type JobEvent } from '../jobEvent'

const event = (route: string, at: string, outcome: JobEvent['outcome'] = 'sent'): JobEvent => ({
  at,
  route,
  trigger: 'cron',
  outcome,
  status: outcome === 'error' ? 500 : 200,
})

describe('jobOutcome', () => {
  it('reads a 5xx as an error whatever the body says', () => {
    expect(jobOutcome(502, { sent: true })).toBe('error')
  })

  it('reads a skip or a push not sent as skipped, and anything else as done', () => {
    expect(jobOutcome(200, { skipped: 'not 08:xx in Paris' })).toBe('skipped')
    expect(jobOutcome(200, { sent: false })).toBe('skipped')
    expect(jobOutcome(200, { sent: true })).toBe('sent')
    expect(jobOutcome(200, { dispatched: true })).toBe('sent')
    expect(jobOutcome(200, null)).toBe('sent')
  })
})

describe('errorName', () => {
  it('keeps a class name and nothing that could carry a message', () => {
    expect(errorName(new TypeError('token abc'))).toBe('TypeError')
    expect(errorName(new AggregateError([], 'x'))).toBe('AggregateError')
    expect(errorName({ name: 'Push failed for token abc' })).toBe('Error')
    expect(errorName('boom')).toBe('Error')
    expect(errorName(null)).toBe('Error')
  })
})

describe('latestPerRoute', () => {
  it('keeps the newest run of each route, newest first', () => {
    const events = [
      event('daily-session', '2026-10-27T07:00:00Z', 'skipped'),
      event('nightly-sync', '2026-10-27T01:00:00Z'),
      event('daily-session', '2026-10-27T06:00:00Z'),
    ]
    expect(latestPerRoute(events)).toEqual([events[0], events[1]])
  })
})

describe('failedSince', () => {
  it('takes only the errors after the mark, and none before a mark exists', () => {
    const events = [
      event('ai-insights', '2026-10-27T02:00:00Z', 'error'),
      event('nightly-sync', '2026-10-27T01:30:00Z'),
      event('pr-check', '2026-10-26T02:00:00Z', 'error'),
    ]
    expect(failedSince(events, '2026-10-27T00:00:00Z')).toEqual([events[0]])
    expect(failedSince(events, null)).toEqual([])
  })
})
