'use client'

import { t } from '@/i18n'

export function TodayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent-subtle"
    >
      {t.calendar.today}
    </button>
  )
}
