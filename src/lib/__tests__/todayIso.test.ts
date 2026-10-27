import { afterEach, describe, expect, it, vi } from 'vitest'
import { appTodayIso, isoDate, todayIso, wallClockHour, wallClockMs } from '../calendarDate'

// 22:30 UTC on 23 September: already the 24th in Luxembourg (UTC+2), still
// the 23rd in New York (UTC-4).
const LATE_EVENING_UTC = new Date('2026-09-23T22:30:00Z')

describe('todayIso', () => {
  it("is the machine's local date when no zone is given", () => {
    expect(todayIso(undefined, LATE_EVENING_UTC)).toBe(isoDate(LATE_EVENING_UTC))
  })

  it('reads the date in the zone it is given', () => {
    expect(todayIso('UTC', LATE_EVENING_UTC)).toBe('2026-09-23')
    expect(todayIso('Europe/Luxembourg', LATE_EVENING_UTC)).toBe('2026-09-24')
    expect(todayIso('America/New_York', LATE_EVENING_UTC)).toBe('2026-09-23')
  })

  it('refuses a zone that does not exist rather than guessing one', () => {
    expect(() => todayIso('Europe/Atlantis', LATE_EVENING_UTC)).toThrow(RangeError)
  })
})

describe('appTodayIso', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads the date in NEXT_PUBLIC_TIME_ZONE when the deployment sets it', () => {
    vi.stubEnv('NEXT_PUBLIC_TIME_ZONE', 'Europe/Luxembourg')
    expect(appTodayIso(LATE_EVENING_UTC)).toBe('2026-09-24')
  })

  it('keeps the local date when it is unset or empty', () => {
    vi.stubEnv('NEXT_PUBLIC_TIME_ZONE', '')
    expect(appTodayIso(LATE_EVENING_UTC)).toBe(isoDate(LATE_EVENING_UTC))
  })
})

describe('wallClockMs', () => {
  it('is the hour on the zone’s clock, summer time or not', () => {
    expect(new Date(wallClockMs('2026-07-01', 18, 'Europe/Luxembourg')).toISOString()).toBe('2026-07-01T16:00:00.000Z')
    expect(new Date(wallClockMs('2026-12-01', 18.5, 'Europe/Luxembourg')).toISOString()).toBe('2026-12-01T17:30:00.000Z')
    expect(new Date(wallClockMs('2026-10-25', 9, 'Europe/Luxembourg')).toISOString()).toBe('2026-10-25T08:00:00.000Z')
    expect(new Date(wallClockMs('2026-07-01', 7, 'America/New_York')).toISOString()).toBe('2026-07-01T11:00:00.000Z')
  })

  it('reads back as the same hour', () => {
    expect(wallClockHour(wallClockMs('2026-03-29', 7.25, 'Europe/Paris'), 'Europe/Paris')).toBe(7.25)
  })
})
