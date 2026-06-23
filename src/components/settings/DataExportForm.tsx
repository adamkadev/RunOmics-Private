'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { Activity } from '@/domain/activity/types'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Toast, useToast } from '@/components/ui/Toast'

const CSV_COLUMNS: { key: keyof Activity; header: string }[] = [
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

function activitiesToCsv(activities: Activity[]): string {
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

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

async function fetchActivities(): Promise<Activity[]> {
  const indexRes = await fetch('/data/activities/index.json')
  const { years } = (await indexRes.json()) as { years: string[] }

  const yearFiles = await Promise.all(
    years.map(async (year) => {
      const res = await fetch(`/data/activities/${year}.json`)
      const data = (await res.json()) as { activities: Activity[] }
      return data.activities
    })
  )
  return yearFiles.flat()
}

export function DataExportForm() {
  const [loading, setLoading] = useState<'csv' | 'json' | null>(null)
  const { toast, showToast } = useToast()

  async function handleExportCsv() {
    setLoading('csv')
    try {
      const activities = await fetchActivities()
      downloadBlob(activitiesToCsv(activities), `runomics-activities-${dateStamp()}.csv`, 'text/csv;charset=utf-8;')
    } catch {
      showToast(t.settings.actions.error, false)
    } finally {
      setLoading(null)
    }
  }

  async function handleExportJson() {
    setLoading('json')
    try {
      const firestore = getClientFirestore()
      const [activities, goalsSnap, pbsSnap, racesSnap, athleteSnap] = await Promise.all([
        fetchActivities(),
        getDocs(collection(firestore, 'goals')),
        getDocs(collection(firestore, 'pbs')),
        getDocs(collection(firestore, 'upcomingRaces')),
        getDoc(doc(firestore, 'athlete', 'profile')),
      ])
      const payload = {
        exportedAt: new Date().toISOString(),
        activities,
        goals: goalsSnap.docs.map((d) => d.data()),
        personalBests: pbsSnap.docs.map((d) => d.data()),
        upcomingRaces: racesSnap.docs.map((d) => d.data()),
        athleteProfile: athleteSnap.exists() ? athleteSnap.data() : null,
      }
      downloadBlob(JSON.stringify(payload, null, 2), `runomics-export-${dateStamp()}.json`, 'application/json')
    } catch {
      showToast(t.settings.actions.error, false)
    } finally {
      setLoading(null)
    }
  }

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <h2 className="text-sm font-bold text-foreground">{t.settings.dataExport.title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{t.settings.dataExport.subtitle}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.08] disabled:opacity-50"
        >
          <Download size={13} />
          {loading === 'csv' ? t.settings.dataExport.exporting : t.settings.dataExport.csv}
        </button>
        <button
          type="button"
          onClick={handleExportJson}
          disabled={loading !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.08] disabled:opacity-50"
        >
          <Download size={13} />
          {loading === 'json' ? t.settings.dataExport.exporting : t.settings.dataExport.json}
        </button>
      </div>

      <Toast toast={toast} />
    </GlassSurface>
  )
}
