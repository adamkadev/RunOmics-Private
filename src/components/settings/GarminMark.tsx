'use client'

import { siGarmin } from 'simple-icons'
import { isSyncLate } from '@/components/dashboard/DashboardGreeting'
import { useMounted } from '@/lib/useMounted'
import { t } from '@/i18n'

export function GarminTile() {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-border bg-[var(--surface-2)]">
      <svg role="img" viewBox="0 0 24 24" width={28} height={28} fill="currentColor" className="text-foreground">
        <title>{t.settings.dataSource.garmin}</title>
        <path d={siGarmin.path} />
      </svg>
    </div>
  )
}

/** Amber past the age Today's stale banner warns at, so the two screens agree. */
export function ConnectedMark({ lastSyncedAt }: { lastSyncedAt: string }) {
  const late = useMounted() && isSyncLate(lastSyncedAt)
  return (
    <span className={late ? 'text-[var(--warn)]' : 'text-[var(--pos)]'} data-testid="garmin-connected">
      <span aria-hidden className={`mr-1.5 inline-block size-1.5 -translate-y-px rounded-full align-middle ${late ? 'bg-[var(--warn)]' : 'bg-[var(--pos)]'}`} />
      <span className="sr-only">{t.settings.dataSource.connectedNow} · </span>
    </span>
  )
}
