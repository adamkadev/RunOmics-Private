import { describe, expect, it } from 'vitest'
import type { JobEvent } from '@/domain/diagnostics/jobEvent'
import { isDailySessionHour, isDailySessionRetry } from '../dailySessionPush'

describe('isDailySessionHour', () => {
  it('sends from the 07:xx UTC cron in winter and skips the 06:xx one', () => {
    expect(isDailySessionHour(new Date('2026-01-15T07:42:00Z'))).toBe(true)
    expect(isDailySessionHour(new Date('2026-01-15T06:42:00Z'))).toBe(false)
  })

  it('sends from the 06:xx UTC cron in summer and skips the 07:xx one', () => {
    expect(isDailySessionHour(new Date('2026-07-15T06:42:00Z'))).toBe(true)
    expect(isDailySessionHour(new Date('2026-07-15T07:42:00Z'))).toBe(false)
  })

  it('follows the clock change on the day itself', () => {
    expect(isDailySessionHour(new Date('2026-03-29T06:05:00Z'))).toBe(true)
    expect(isDailySessionHour(new Date('2026-10-25T07:05:00Z'))).toBe(true)
  })
})

describe('isDailySessionRetry', () => {
  const run = (at: string, outcome: JobEvent['outcome']): JobEvent => ({ at, route: 'daily-session', trigger: 'cron', outcome, status: outcome === 'error' ? 500 : 200 })

  it('lets the summer 07:xx UTC cron send after the 08:xx Paris run failed that morning', () => {
    expect(isDailySessionRetry(new Date('2026-07-15T07:00:05Z'), run('2026-07-15T06:00:03Z', 'error'))).toBe(true)
  })

  it('does not retry a run that worked, skipped or failed on another day', () => {
    expect(isDailySessionRetry(new Date('2026-07-15T07:00:05Z'), run('2026-07-15T06:00:03Z', 'sent'))).toBe(false)
    expect(isDailySessionRetry(new Date('2026-07-15T07:00:05Z'), run('2026-07-14T06:00:03Z', 'error'))).toBe(false)
    expect(isDailySessionRetry(new Date('2026-07-15T07:00:05Z'), null)).toBe(false)
  })

  it('never retries from 10:00 Paris, nor before the push’s own hour', () => {
    expect(isDailySessionRetry(new Date('2026-07-15T08:00:05Z'), run('2026-07-15T06:00:03Z', 'error'))).toBe(false)
    expect(isDailySessionRetry(new Date('2026-01-15T06:00:05Z'), run('2026-01-15T05:59:00Z', 'error'))).toBe(false)
  })

  it('does not retry after a failed run outside the push’s hour', () => {
    expect(isDailySessionRetry(new Date('2026-07-15T07:30:00Z'), run('2026-07-15T07:00:03Z', 'error'))).toBe(false)
  })
})
