'use client'

import { useState } from 'react'
import { Activity, Download } from 'lucide-react'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Toast, useToast } from '@/components/ui/Toast'

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DataSourceInfo() {
  const [loading, setLoading] = useState(false)
  const { toast, showToast } = useToast()
  const s = t.settings

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch('/api/activities/export')
      const csv = await res.text()
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(csv, `runomics-activities-${stamp}.csv`, 'text/csv;charset=utf-8;')
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

      <Toast toast={toast} />
    </GlassSurface>
  )
}
