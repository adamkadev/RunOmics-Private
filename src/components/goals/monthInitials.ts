import { t } from '@/i18n'

/**
 * Jan-Dec as the locale's initials, "J F M A …" (3.1): a twelve-column axis
 * on a phone. Its full name goes in the bar's title and the label's aria.
 */
export function monthInitials(): string[] {
  const narrow = new Intl.DateTimeFormat(t.locale, { month: 'narrow', timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_, i) => narrow.format(new Date(Date.UTC(2000, i, 1))).toUpperCase())
}
