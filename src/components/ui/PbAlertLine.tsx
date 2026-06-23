import Link from 'next/link'
import { Flame } from 'lucide-react'
import { formatClock, formatDateWithYear } from '@/lib/formatters'
import { t } from '@/i18n'
import type { PbAlert } from '@/application/usecases/GetPbAlerts'

export function PbAlertLine({ alerts }: { alerts: PbAlert[] }) {
  if (alerts.length === 0) return null

  const s = t.pbAlerts

  return (
    <p className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-3.5 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
      <Flame className="h-4 w-4 shrink-0" aria-hidden="true" />
      {alerts.map((a, i) => (
        <span key={a.key} className="flex items-center gap-1.5">
          <Link href={`/activities/${a.activityId}`} className="underline-offset-2 hover:underline">
            {a.label} {s.off(formatClock(a.diffSeconds))} ({formatDateWithYear(a.date)})
          </Link>
          {i < alerts.length - 1 && <span aria-hidden="true">·</span>}
        </span>
      ))}
    </p>
  )
}
