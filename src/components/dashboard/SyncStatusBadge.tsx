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

  // Severity tiers reflect how badly the data lags a daily sync schedule:
  // fresh (<6h), getting stale (6-24h), and stale (>=24h).
  const hoursElapsed = (new Date().getTime() - new Date(lastSyncedAt).getTime()) / 3_600_000
  const severity = hoursElapsed >= 24 ? STATUS.danger : hoursElapsed >= 6 ? STATUS.warning : STATUS.success

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
