import { describe, expect, it } from 'vitest'
import { isDailySessionHour } from '../dailySessionPush'

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
