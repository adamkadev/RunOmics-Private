'use client'

import { useState } from 'react'
import { Activity, Download } from 'lucide-react'
import type { Activity as ActivityModel } from '@/domain/activity/types'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Toast, useToast } from '@/components/ui/Toast'

const CSV_COLUMNS: { key: keyof ActivityModel; header: string }[] = [
  { key: 'date', header: 'date' },
  { key: 'dayOfWeek', header: 'dayOfWeek' },
  { key: 'type', header: 'type' },
  { key: 'description', header: 'description' },
  { key: 'durationSeconds', header: 'durationSeconds' },
  { key: 'distanceKm', header: 'distanceKm' },
  { key: 'paceSecPerKm', header: 'paceSecPerKm' },
  { key: 'avgHeartRate', header: 'avgHeartRate' },
  { key: 'rpe', header: 'rpe' },
  { key: 'elevationGain', header: 'elevationGain' },
  { key: 'aerTrainingEffect', header: 'aerTrainingEffect' },
  { key: 'anaTrainingEffect', header: 'anaTrainingEffect' },
  { key: 'calories', header: 'calories' },
  { key: 'cadenceSpm', header: 'cadenceSpm' },
  { key: 'groundContactMs', header: 'groundContactMs' },
  { key: 'verticalOscillationMm', header: 'verticalOscillationMm' },
  { key: 'verticalRatioPct', header: 'verticalRatioPct' },
  { key: 'strideLengthM', header: 'strideLengthM' },
  { key: 'vo2maxGarmin', header: 'vo2maxGarmin' },
  { key: 'avgTemperature', header: 'avgTemperature' },
  { key: 'comment', header: 'comment' },
]

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function activitiesToCsv(activities: ActivityModel[]): string {
  const header = CSV_COLUMNS.map((c) => c.header).join(',')
  const rows = activities.map((a) => CSV_COLUMNS.map((c) => csvEscape(a[c.key])).join(','))
  return [header, ...rows].join('\n')
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function fetchActivities(): Promise<ActivityModel[]> {
  const indexRes = await fetch('/data/activities/index.json')
  const { years } = (await indexRes.json()) as { years: string[] }
  const yearFiles = await Promise.all(
    years.map(async (year) => {
      const res = await fetch(`/data/activities/${year}.json`)
      const data = (await res.json()) as { activities: ActivityModel[] }
      return data.activities
    })
  )
  return yearFiles.flat()
}

export function DataSourceInfo() {
  const [loading, setLoading] = useState(false)
  const { toast, showToast } = useToast()
  const s = t.settings

  async function handleExport() {
    setLoading(true)
    try {
      const activities = await fetchActivities()
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(activitiesToCsv(activities), `runomics-activities-${stamp}.csv`, 'text/csv;charset=utf-8;')
    } catch {
      showToast(s.dataExport.exporting, false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
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
