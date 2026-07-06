'use client'

import { useState } from 'react'
import { Activity, Download, Trash2 } from 'lucide-react'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Toast, useToast } from '@/components/ui/Toast'
import { saveFileWithFallback } from '@/lib/fileExport'

export function DataSourceInfo() {
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
      <div className="flex items-center gap-3">
        <Activity size={16} className="shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">{s.dataSource.title}</p>
          <p className="text-xs text-muted-foreground">
            {s.dataSource.garmin} - {s.dataSource.syncMethod}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.04] px-4 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.08] disabled:opacity-50"
      >
        <Download size={16} />
        {loading ? s.dataExport.exporting : s.dataExport.csv}
      </button>

      <button
        type="button"
        onClick={handleClearCache}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.04] px-4 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.08]"
      >
        <Trash2 size={16} />
        {s.offlineCache.clear}
      </button>

      <Toast toast={toast} leaving={leaving} />
    </GlassSurface>
  )
}
