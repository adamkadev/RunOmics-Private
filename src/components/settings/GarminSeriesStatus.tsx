'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { GarminSeriesStatus as GarminSeriesProps } from '@/application/usecases/GetSyncStatus'
import type { SeriesFreshness } from '@/domain/sync/seriesFreshness'
import { t } from '@/i18n'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { GROUP_CARD, GROUP_ROW } from './settingsGroup'

export type { GarminSeriesProps }

function SeriesRow({ row }: { row: SeriesFreshness }) {
  const d = t.settings.diagnostics.garminSeries
  const detail = row.newest === null ? d.never : row.stale ? d.staleSince(formatDate(row.newest)) : d.newest(formatDate(row.newest))
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm" data-testid="garmin-series" data-stale={row.stale || undefined}>
      <span className="min-w-0 truncate text-foreground">{d.names[row.series]}</span>
      <span className={cn('shrink-0 text-right', row.stale ? 'text-[var(--neg)]' : 'text-muted-foreground')}>{detail}</span>
    </li>
  )
}

export function GarminSeriesStatus({ series, warningSteps, warningCount }: GarminSeriesProps) {
  const d = t.settings.diagnostics.garminSeries
  const [open, setOpen] = useState(false)
  const stopped = series.filter((row) => row.stale).length
  if (series.every((row) => row.newest === null) && warningCount === 0) return null

  return (
    <div className={GROUP_CARD} data-testid="garmin-series-status">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(GROUP_ROW, 'transition-colors hover:bg-[var(--surface-2)]')}
      >
        <span className="min-w-0">{d.title}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className={cn('text-sm', stopped > 0 || warningCount > 0 ? 'text-[var(--neg)]' : 'text-muted-foreground')}>
            {stopped > 0 ? d.stopped(stopped) : d.allCurrent}
          </span>
          <ChevronRight size={16} aria-hidden="true" className={cn('text-muted-foreground transition-transform', open && 'rotate-90')} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 px-4 pb-3.5">
          {warningCount > 0 && (
            <p className="text-xs text-[var(--neg)]" data-testid="garmin-warnings">
              {d.warnings(warningCount, warningSteps.join(', '))}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {series.map((row) => (
              <SeriesRow key={row.series} row={row} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
