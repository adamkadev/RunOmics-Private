import { t } from '@/i18n'

export function monthInitials(): string[] {
  const narrow = new Intl.DateTimeFormat(t.locale, { month: 'narrow', timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_, i) => narrow.format(new Date(Date.UTC(2000, i, 1))).toUpperCase())
}
