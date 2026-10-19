'use client'

import { useRouter } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import type { User } from 'firebase/auth'
import { Button } from '@/components/ui/Button'
import { useMounted } from '@/lib/useMounted'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { useSyncNow } from '@/components/settings/SyncNowCard'
import { isSyncLate, syncAgeMs } from './DashboardGreeting'
import { formatWeekdayTime } from '@/lib/formatters'
import { t } from '@/i18n'

function OwnerSyncButton({ user, label }: { user: User; label: string }) {
  const sync = useSyncNow(user)
  const pending = sync.phase.kind === 'starting' || sync.phase.kind === 'waiting'
  return (
    <Button onClick={sync.handleSync} disabled={pending} className="hit-44 h-11 shrink-0 px-4">
      {pending ? t.dashboard.syncStatus.syncing : label}
    </Button>
  )
}

function SyncButton({ label }: { label: string }) {
  const { user, isOwner } = useOwnerAuth()
  const router = useRouter()
  if (user && isOwner) return <OwnerSyncButton user={user} label={label} />
  return (
    <Button onClick={() => router.push('/settings')} className="hit-44 h-11 shrink-0 px-4">
      {label}
    </Button>
  )
}

export function StaleSyncBanner({ lastSyncedAt }: { lastSyncedAt?: string | null }) {
  const mounted = useMounted()
  if (!mounted || !lastSyncedAt || !isSyncLate(lastSyncedAt)) return null

  const s = t.dashboard.stale
  const hours = Math.floor(syncAgeMs(lastSyncedAt) / 3600_000)

  return (
    <section
      data-testid="stale-banner"
      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{
        borderColor: 'color-mix(in srgb, var(--warn) 35%, transparent)',
        background: 'color-mix(in srgb, var(--warn) 12%, var(--card))',
      }}
    >
      <TriangleAlert size={20} strokeWidth={2.2} className="shrink-0" style={{ color: 'var(--warn)' }} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold leading-snug text-foreground text-pretty">{s.title(hours)}</span>
        <span className="text-xs leading-snug text-[var(--text-2)] text-pretty">{s.line(formatWeekdayTime(lastSyncedAt))}</span>
      </div>
      <SyncButton label={s.sync} />
    </section>
  )
}
