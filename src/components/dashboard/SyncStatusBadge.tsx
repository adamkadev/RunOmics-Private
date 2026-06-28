import { RefreshCw } from 'lucide-react'
import { t } from '@/i18n'
import { relativeTimeParts } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'

export function SyncStatusBadge({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  if (!lastSyncedAt) return null

  const s = t.dashboard.syncStatus
  const { unit, value } = relativeTimeParts(lastSyncedAt)
  const relative =
    unit === 'now' ? s.justNow :
    unit === 'minutes' ? s.minutesAgo(value) :
    unit === 'hours' ? s.hoursAgo(value) :
    s.daysAgo(value)

  // Stale once the gap reaches a full day - this app expects roughly daily syncs.
  const isStale = unit === 'days'

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.04] px-2.5 py-1 text-xs font-medium',
        isStale ? STATUS.warning.text : 'text-muted-foreground'
      )}
    >
      <RefreshCw size={12} />
      {s.synced(relative)}
    </span>
  )
}
