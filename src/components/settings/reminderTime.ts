import { t } from '@/i18n'

/**
 * When the daily session reminder goes out, in UTC: the cron of
 * .github/workflows/daily-session-reminder.yml ("11 6 * * *"). Nothing stores
 * a reminder time of its own, so the row shows the one the workflow keeps.
 */
export const DAILY_REMINDER_UTC = { hour: 6, minute: 11 } as const

/**
 * The reminder's time on `day`, read in `timeZone` (the athlete's, when the
 * app is told it) or the device's own: "08:11" in Paris in summer, "07:11" in
 * winter. The day matters, since the cron is UTC and summer time is not.
 */
export function dailyReminderTime(day: Date = new Date(), timeZone?: string): string {
  const at = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), DAILY_REMINDER_UTC.hour, DAILY_REMINDER_UTC.minute))
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? DAILY_REMINDER_UTC.hour)
  const minute = parts.find((p) => p.type === 'minute')?.value ?? String(DAILY_REMINDER_UTC.minute)
  return t.settings.notifications.at(hour, minute)
}
