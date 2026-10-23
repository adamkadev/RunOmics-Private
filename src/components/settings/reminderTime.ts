import { t } from '@/i18n'

/** Must match the cron of .github/workflows/daily-session-reminder.yml ("11 6 * * *", UTC). */
export const DAILY_REMINDER_UTC = { hour: 6, minute: 11 } as const

/** The day matters: the cron is UTC and summer time is not. */
export function dailyReminderTime(day: Date = new Date(), timeZone?: string): string {
  const at = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), DAILY_REMINDER_UTC.hour, DAILY_REMINDER_UTC.minute))
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? DAILY_REMINDER_UTC.hour)
  const minute = parts.find((p) => p.type === 'minute')?.value ?? String(DAILY_REMINDER_UTC.minute)
  return t.settings.notifications.at(hour, minute)
}
