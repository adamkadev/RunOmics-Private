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

  // Sync runs once a day, so severity tiers are calibrated to that cadence:
  // on schedule (<24h), one sync missed (24-48h), multiple syncs missed (>=48h).
  const hoursElapsed = (new Date().getTime() - new Date(lastSyncedAt).getTime()) / 3_600_000
  const severity = hoursElapsed >= 48 ? STATUS.danger : hoursElapsed >= 24 ? STATUS.warning : STATUS.success

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.04] px-2.5 py-1 text-xs font-medium',
        severity.text
      )}
    >
      <RefreshCw size={12} />
      {s.synced(relative)}
    </span>
  )
}
