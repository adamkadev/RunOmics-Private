'use client'

import { useState } from 'react'
import type { User } from 'firebase/auth'
import { siGarmin } from 'simple-icons'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Toast, useToast } from '@/components/ui/Toast'
import { saveFileWithFallback } from '@/lib/fileExport'
import { authorizedFetch } from '@/lib/ownerFetch'
import { formatDate, formatRelativeAgo } from '@/lib/formatters'

export interface SyncDevice {
  name?: string
  since?: string
}

interface Props {
  lastSyncedAt: string | null
  activityCount: number
  device?: SyncDevice
  /** Needed for the export's ID token - the route is owner-only. */
  user: User
}

export function DataSourceInfo({ lastSyncedAt, activityCount, device, user }: Props) {
  const [loading, setLoading] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const { toast, leaving, showToast } = useToast()
  const s = t.settings

  async function handleClearCache() {
    setConfirmingClear(false)
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      showToast(s.offlineCache.cleared, true)
    } catch {
      showToast(s.offlineCache.failed, false)
    }
  }

  async function handleExport() {
    setLoading(true)
    try {
      const res = await authorizedFetch(user, '/api/activities/export')
      if (!res.ok) throw new Error(`Export failed with ${res.status}`)
      const workbook = await res.blob()
      const stamp = new Date().toISOString().slice(0, 10)
      const file = new File([workbook], `runomics-training-data-${stamp}.xlsx`, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      await saveFileWithFallback(file)
    } catch {
      showToast(s.dataExport.failed, false)
    } finally {
      setLoading(false)
    }
  }

  const provenance = device && [
    s.dataSource.garmin,
    device.since && s.dataSource.since(formatDate(device.since, { precision: 'month' })),
  ].filter(Boolean).join(' · ')

  return (
    <GlassSurface variant="card" className="p-5">
      {lastSyncedAt && (
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-accent/[0.14]">
            <svg
              role="img"
              viewBox="0 0 24 24"
              width={19}
              height={19}
              fill="currentColor"
              className="text-accent"
            >
              <title>{s.dataSource.garmin}</title>
              <path d={siGarmin.path} />
            </svg>
            <span
              className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-accent ring-2 ring-card"
              style={{ boxShadow: '0 0 8px var(--accent)', animation: 'pulse-ring 2s ease-in-out infinite' }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {device?.name ?? s.dataSource.connected(s.dataSource.garmin)}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {s.dataSource.lastSync} {formatRelativeAgo(lastSyncedAt)} · {t.common.runs(activityCount)}
            </p>
            {device?.name && provenance && (
              <p className="mt-0.5 truncate text-caption text-subtle-2">{provenance}</p>
            )}
          </div>
        </div>
      )}

      {lastSyncedAt && <div className="my-4 h-px bg-foreground/[0.06]" />}

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleExport}
          disabled={loading}
          className="flex w-full items-center justify-between gap-2 text-footnote text-muted-foreground transition-opacity active:opacity-60 disabled:opacity-50"
        >
          <span>{loading ? s.dataExport.exporting : s.dataExport.workbook}</span>
          <span className="shrink-0 font-semibold text-accent-text">{s.rowAction.export}</span>
        </button>

        <div>
          <div className="flex w-full items-center justify-between gap-2 text-footnote text-muted-foreground">
            <span>{s.offlineCache.clear}</span>
            {confirmingClear ? (
              <span className="flex shrink-0 items-center gap-3 font-semibold">
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="text-muted-foreground transition-opacity active:opacity-60"
                >
                  {s.actions.confirmCancel}
                </button>
                <button
                  type="button"
                  onClick={handleClearCache}
                  className="text-destructive transition-opacity active:opacity-60"
                >
                  {s.actions.confirmYes}
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="shrink-0 font-semibold text-destructive transition-opacity active:opacity-60"
              >
                {s.rowAction.clear}
              </button>
            )}
          </div>
          <p className="mt-0.5 text-caption leading-snug text-subtle">
            {confirmingClear ? s.offlineCache.confirm : s.offlineCache.cost}
          </p>
        </div>
      </div>

      <Toast toast={toast} leaving={leaving} />
    </GlassSurface>
  )
}
