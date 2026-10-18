'use client'

import { useState } from 'react'
import type { User } from 'firebase/auth'
import { t } from '@/i18n'
import { cardClass } from '@/components/ui/Card'
import { Toast, useToast } from '@/components/ui/Toast'
import { saveFileWithFallback } from '@/lib/fileExport'
import { authorizedFetch } from '@/lib/ownerFetch'
import { NOTES_UNAVAILABLE_HEADER } from '@/lib/exportHeaders'
import { formatDate, formatRelativeAgo } from '@/lib/formatters'
import { SyncNowButton, SyncVerdict, useSyncNow } from './SyncNowCard'
import { ConnectedMark, GarminTile } from './GarminMark'
import { ExportSheet, type ExportOption } from './ExportSheet'

export interface SyncDevice {
  name?: string
  since?: string
}

interface Props {
  lastSyncedAt: string | null
  activityCount: number
  device?: SyncDevice
  /** Needed for the export's and the sync's ID token - both routes are owner-only. */
  user: User
  /** For the tests; see useSyncNow. */
  pollIntervalMs?: number
}

type ExportFormat = 'xlsx' | 'csv'

const EXPORT_FILE: Record<ExportFormat, { name: string; type: string }> = {
  xlsx: { name: 'runomics-training-data', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  csv: { name: 'runomics-activities', type: 'text/csv' },
}

/**
 * The one Garmin card (v5.6 #6): the device, when it last synced, and "Sync
 * now" on the same row, then export and the offline cache. The sync had a
 * card of its own that repeated the device's.
 */
export function DataSourceInfo({ lastSyncedAt, activityCount, device, user, pollIntervalMs }: Props) {
  const sync = useSyncNow(user, pollIntervalMs)
  const [loading, setLoading] = useState<ExportFormat | null>(null)
  const [pickingFormat, setPickingFormat] = useState(false)
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

  async function handleExport(format: ExportFormat) {
    setLoading(format)
    try {
      const res = await authorizedFetch(user, `/api/activities/export?format=${format}`)
      if (!res.ok) throw new Error(`Export failed with ${res.status}`)
      const body = await res.blob()
      const stamp = new Date().toISOString().slice(0, 10)
      const file = new File([body], `${EXPORT_FILE[format].name}-${stamp}.${format}`, { type: EXPORT_FILE[format].type })
      await saveFileWithFallback(file)
      // The file is saved either way; a blank comment column must not pass for "no notes".
      if (res.headers.get(NOTES_UNAVAILABLE_HEADER)) showToast(s.dataExport.notesUnavailable, false)
    } catch {
      showToast(s.dataExport.failed, false)
    } finally {
      setLoading(null)
    }
  }

  const exportOptions: ExportOption[] = [
    { key: 'xlsx', title: s.dataExport.workbookTitle, extension: '.xlsx', hint: s.dataExport.workbookHint, onSelect: () => handleExport('xlsx') },
    { key: 'csv', title: s.dataExport.csvTitle, extension: '.csv', hint: s.dataExport.csvHint, onSelect: () => handleExport('csv') },
  ]

  const provenance = device?.name && device.since
    ? s.dataSource.sourceSince(s.dataSource.garmin, formatDate(device.since, { precision: 'month' }))
    : null

  return (
    <section className={cardClass({ padding: 'none', className: 'px-5' })} data-testid="data-card">
      <div className="flex items-center gap-3.5 border-b border-border py-4" data-testid="garmin-row">
        <GarminTile />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {device?.name ?? s.dataSource.connected(s.dataSource.garmin)}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {lastSyncedAt && !sync.progress && (
              <>
                <ConnectedMark />
                {' · '}
              </>
            )}
            <span data-testid="sync-line">
              {sync.progress ??
                (lastSyncedAt
                  ? `${s.dataSource.lastSyncedAgo(formatRelativeAgo(lastSyncedAt))} · ${t.common.runs(activityCount)}`
                  : s.sync.subtitle)}
            </span>
            {provenance && !sync.progress && ` · ${provenance}`}
          </p>
        </div>
      </div>

      <div className="border-b border-border py-3.5">
        <SyncNowButton sync={sync} />
      </div>

      <SyncVerdict sync={sync} />

      <button
        type="button"
        onClick={() => setPickingFormat(true)}
        disabled={loading !== null}
        data-testid="export-row"
        className="flex w-full items-center justify-between gap-3 border-b border-border py-3.5 text-left text-sm text-foreground transition-opacity active:opacity-60 disabled:opacity-50"
      >
        <span className="min-w-0">
          <span className="block">{loading ? s.dataExport.exporting : s.dataExport.title}</span>
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{s.dataExport.ownerHint(t.common.runs(activityCount))}</span>
        </span>
        <span className="shrink-0 text-[13px] font-medium text-accent-text">{s.rowAction.export}</span>
      </button>

      <div className="flex items-center justify-between gap-3 py-3.5">
        <div className="min-w-0">
          <p className="text-sm text-foreground">{s.offlineCache.clear}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {confirmingClear ? s.offlineCache.confirm : s.offlineCache.cost}
          </p>
        </div>
        {confirmingClear ? (
          <span className="flex shrink-0 items-center gap-3 text-[13px] font-medium">
            <button type="button" onClick={() => setConfirmingClear(false)} className="hit-44 text-muted-foreground transition-opacity active:opacity-60">
              {s.actions.confirmCancel}
            </button>
            <button type="button" onClick={handleClearCache} className="hit-44 text-[var(--neg)] transition-opacity active:opacity-60">
              {s.actions.confirmYes}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            className="hit-44 shrink-0 text-[13px] font-medium text-[var(--neg)] transition-opacity active:opacity-60"
          >
            {s.rowAction.clear}
          </button>
        )}
      </div>

      {pickingFormat && <ExportSheet options={exportOptions} onClose={() => setPickingFormat(false)} />}

      <Toast toast={toast} leaving={leaving} />
    </section>
  )
}
