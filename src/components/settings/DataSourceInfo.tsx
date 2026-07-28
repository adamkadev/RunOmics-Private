'use client'

import { useState } from 'react'
import { siGarmin } from 'simple-icons'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Toast, useToast } from '@/components/ui/Toast'
import { saveFileWithFallback } from '@/lib/fileExport'
import { formatMonthYear, formatRelativeAgo } from '@/lib/formatters'

export interface SyncDevice {
  name?: string
  /** ISO date the watch was paired with Garmin Connect. */
  since?: string
}

interface Props {
  lastSyncedAt: string | null
  activityCount: number
  device?: SyncDevice
}

export function DataSourceInfo({ lastSyncedAt, activityCount, device }: Props) {
  const [loading, setLoading] = useState(false)
  const { toast, leaving, showToast } = useToast()
  const s = t.settings

  // Escape hatch for stale offline content: drop every SW cache. The service
  // worker repopulates them on the next loads.
  async function handleClearCache() {
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
      const res = await fetch('/api/activities/export')
      const csv = await res.text()
      const stamp = new Date().toISOString().slice(0, 10)
      // Share sheet on iOS PWAs (no downloads UI there), download elsewhere.
      const file = new File([csv], `runomics-activities-${stamp}.csv`, { type: 'text/csv' })
      await saveFileWithFallback(file)
    } catch {
      showToast(s.dataExport.exporting, false)
    } finally {
      setLoading(false)
    }
  }

  // Device provenance, shown only once the sync has actually reported a watch.
  const provenance = device && [
    s.dataSource.garmin,
    device.since && s.dataSource.since(formatMonthYear(device.since)),
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
          <span>{loading ? s.dataExport.exporting : s.dataExport.csv}</span>
          <span className="shrink-0 font-semibold text-accent-text">{s.rowAction.export}</span>
        </button>

        <button
          type="button"
          onClick={handleClearCache}
          className="flex w-full items-center justify-between gap-2 text-footnote text-muted-foreground transition-opacity active:opacity-60"
        >
          <span>{s.offlineCache.clear}</span>
          <span className="shrink-0 font-semibold text-accent-text">{s.rowAction.clear}</span>
        </button>
      </div>

      <Toast toast={toast} leaving={leaving} />
    </GlassSurface>
  )
}
