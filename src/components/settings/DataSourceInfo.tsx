'use client'

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { User } from 'firebase/auth'
import { t } from '@/i18n'
import { Toast, useToast } from '@/components/ui/Toast'
import { saveFileWithFallback } from '@/lib/fileExport'
import { authorizedFetch } from '@/lib/ownerFetch'
import { NOTES_UNAVAILABLE_HEADER } from '@/lib/exportHeaders'
import { formatRelativeAgo } from '@/lib/formatters'
import { SyncNowButton, SyncVerdict, useRefreshWhenLive, useSyncNow } from './SyncNowCard'
import { ConnectedMark, GarminTile } from './GarminMark'
import { ExportSheet, type ExportOption } from './ExportSheet'
import { formatCacheSize, offlineCacheBytes } from './offlineCache'
import { GROUP_CARD, GROUP_ROW } from './settingsGroup'

export interface SyncDevice {
  name?: string
}

interface Props {
  lastSyncedAt: string | null
  activityCount: number
  device?: SyncDevice
  /** Signs the ID token both owner-only routes, export and sync, require. */
  user: User
  onDataLive?: () => void
  /** Tests only; see useSyncNow. */
  pollIntervalMs?: number
}

type ExportFormat = 'xlsx' | 'csv'

const EXPORT_FILE: Record<ExportFormat, { name: string; type: string }> = {
  xlsx: { name: 'runomics-training-data', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  csv: { name: 'runomics-activities', type: 'text/csv' },
}

const CHEVRON = <ChevronRight size={16} aria-hidden className="shrink-0 text-subtle" />

export function DataSourceInfo({ lastSyncedAt, activityCount, device, user, onDataLive, pollIntervalMs }: Props) {
  const sync = useSyncNow(user, pollIntervalMs)
  useRefreshWhenLive(sync.phase, onDataLive)
  const [loading, setLoading] = useState<ExportFormat | null>(null)
  const [pickingFormat, setPickingFormat] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [cacheSize, setCacheSize] = useState<string | null>(null)
  const { toast, leaving, showToast } = useToast()
  const s = t.settings

  useEffect(() => {
    let live = true
    void offlineCacheBytes().then((bytes) => {
      if (live) setCacheSize(formatCacheSize(bytes))
    })
    return () => {
      live = false
    }
  }, [])

  async function handleClearCache() {
    setConfirmingClear(false)
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      showToast(s.offlineCache.cleared, true)
    } catch {
      showToast(s.offlineCache.failed, false)
    }
    setCacheSize(formatCacheSize(await offlineCacheBytes()))
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
      // A blank notes column must not pass for "no notes".
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

  return (
    <>
    <section className={GROUP_CARD} data-testid="data-card">
      <div className="flex items-center gap-3 px-4 py-3" data-testid="garmin-row" data-row-thumb>
        <GarminTile />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {device?.name ?? s.dataSource.connected(s.dataSource.garmin)}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {lastSyncedAt && !sync.progress && <ConnectedMark />}
            <span data-testid="sync-line">
              {sync.progress ??
                (lastSyncedAt
                  ? `${s.dataSource.lastSyncedAgo(formatRelativeAgo(lastSyncedAt))} · ${t.common.runs(activityCount)}`
                  : s.sync.subtitle)}
            </span>
          </p>
        </div>
        <SyncNowButton sync={sync} />
      </div>

      <SyncVerdict sync={sync} />

      <button
        type="button"
        onClick={() => setPickingFormat(true)}
        disabled={loading !== null}
        data-testid="export-row"
        className={`${GROUP_ROW} text-sm text-foreground transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50`}
      >
        <span className="min-w-0 truncate">{loading ? s.dataExport.exporting : s.dataExport.title}</span>
        {CHEVRON}
      </button>

      {/* Neutral, not red: clearing costs a reload and loses nothing. */}
      {confirmingClear ? (
        <div className={GROUP_ROW} data-testid="cache-confirm">
          <span className="min-w-0">
            <span className="block text-sm text-foreground">{s.offlineCache.clear}</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{s.offlineCache.confirm}</span>
          </span>
          <span className="flex shrink-0 items-center gap-4 text-sm">
            <button type="button" onClick={() => setConfirmingClear(false)} className="hit-44 text-muted-foreground transition-opacity active:opacity-60">
              {s.actions.confirmCancel}
            </button>
            <button type="button" onClick={handleClearCache} className="hit-44 font-semibold text-foreground transition-opacity active:opacity-60">
              {s.offlineCache.confirmAction}
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingClear(true)}
          data-testid="cache-row"
          className={`${GROUP_ROW} text-sm text-foreground transition-colors hover:bg-[var(--surface-2)]`}
        >
          <span className="min-w-0 truncate">{s.offlineCache.clear}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            {cacheSize && <span className="tabular-nums" data-testid="cache-size">{cacheSize}</span>}
            {CHEVRON}
          </span>
        </button>
      )}

      {pickingFormat && <ExportSheet options={exportOptions} onClose={() => setPickingFormat(false)} />}
    </section>
    {/* Outside the group, so its separators never count it as a row. */}
    <Toast toast={toast} leaving={leaving} />
    </>
  )
}
