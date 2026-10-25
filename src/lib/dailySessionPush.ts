/** Vercel's two daily crons (06:xx and 07:xx UTC) straddle Paris summer time; only the one in this hour sends. */
export const DAILY_SESSION_PUSH = { timeZone: 'Europe/Paris', hour: 8 } as const

export function hourIn(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).formatToParts(at)
  return Number(parts.find((p) => p.type === 'hour')?.value)
}

export function isDailySessionHour(at: Date): boolean {
  return hourIn(DAILY_SESSION_PUSH.timeZone, at) === DAILY_SESSION_PUSH.hour
}

/** When the push's hour starts on `day`'s UTC date: 07:00 UTC in winter, 06:00 UTC in summer. */
export function dailySessionPushAt(day: Date): Date {
  const at = (utcHour: number) => new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), utcHour))
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    if (isDailySessionHour(at(utcHour))) return at(utcHour)
  }
  return at(DAILY_SESSION_PUSH.hour)
}
