'use client'

import { useState } from 'react'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Toast, useToast } from '@/components/ui/Toast'
import { saveFileWithFallback } from '@/lib/fileExport'
import { formatRelativeAgo } from '@/lib/formatters'

interface Props {
  lastSyncedAt: string | null
  activityCount: number
}

export function DataSourceInfo({ lastSyncedAt, activityCount }: Props) {
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

  return (
    <GlassSurface variant="card" className="p-5">
      {lastSyncedAt && (
        <div className="flex items-center gap-3.5">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-accent/[0.14]">
            <span
              className="h-2 w-2 rounded-full bg-accent"
              style={{ boxShadow: '0 0 8px var(--accent)', animation: 'pulse-ring 2s ease-in-out infinite' }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{s.dataSource.connected(s.dataSource.garmin)}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
              {s.dataSource.lastSync} {formatRelativeAgo(lastSyncedAt)} · {t.common.runs(activityCount)}
            </p>
          </div>
        </div>
      )}

      {lastSyncedAt && <div className="my-4 h-px bg-foreground/[0.06]" />}

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleExport}
          disabled={loading}
          className="flex w-full items-center justify-between gap-2 text-[12.5px] text-muted-foreground transition-opacity active:opacity-60 disabled:opacity-50"
        >
          <span>{loading ? s.dataExport.exporting : s.dataExport.csv}</span>
          <span className="shrink-0 font-semibold text-accent-text">{s.rowAction.export}</span>
        </button>

        <button
          type="button"
          onClick={handleClearCache}
          className="flex w-full items-center justify-between gap-2 text-[12.5px] text-muted-foreground transition-opacity active:opacity-60"
        >
          <span>{s.offlineCache.clear}</span>
          <span className="shrink-0 font-semibold text-accent-text">{s.rowAction.clear}</span>
        </button>
      </div>

      <Toast toast={toast} leaving={leaving} />
    </GlassSurface>
  )
}
