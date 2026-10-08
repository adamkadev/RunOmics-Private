import Link from 'next/link'
import { Flame } from 'lucide-react'
import { formatClock, formatDate } from '@/lib/formatters'
import { t } from '@/i18n'
import type { PbAlert } from '@/application/usecases/GetPbAlerts'

export function PbAlertLine({ alerts }: { alerts: PbAlert[] }) {
  if (alerts.length === 0) return null

  const s = t.pbAlerts

  return (
    <p className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[var(--tone-caution)]/40 px-3.5 py-1.5 text-sm font-medium text-[var(--tone-caution)]">
      <Flame className="h-4 w-4 shrink-0" aria-hidden="true" />
      {alerts.map((a, i) => (
        <span key={a.key} className="flex items-center gap-1.5">
          <Link href={`/activities/${a.activityId}`} className="hit-44 underline-offset-2 hover:underline">
            {a.label} {s.off(formatClock(a.diffSeconds))} ({formatDate(a.date, { style: 'bare', year: 'always' })})
          </Link>
          {i < alerts.length - 1 && <span aria-hidden="true">·</span>}
        </span>
      ))}
    </p>
  )
}
