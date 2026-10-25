import { t } from '@/i18n'
import { dailySessionPushAt } from '@/lib/dailySessionPush'

/** The day matters: the push keeps Paris time, summer time included, and the athlete's zone may not. */
export function dailyReminderTime(day: Date = new Date(), timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(dailySessionPushAt(day))
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return t.settings.notifications.at(hour, minute)
}
