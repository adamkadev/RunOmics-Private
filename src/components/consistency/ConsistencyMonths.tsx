'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { LABELLED_ROWS, ROWS, type ConsistencyCell, type ConsistencyView, type DayState } from './consistencyMonths'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/**
 * A day's fill (C1, v4.4): rest the faint track, a run the accent mixed 55%
 * into the card, a long run the accent itself. Days still to come are an
 * outline, and today a ring in text ink.
 */
const FILL: Record<DayState, CSSProperties> = {
  rest: { background: 'var(--track)' },
  run: { background: 'color-mix(in oklab, var(--accent) 55%, var(--card))' },
  long: { background: 'var(--accent)' },
  future: { background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--border)' },
  none: { background: 'transparent' },
}
const TODAY_RING = '0 0 0 1.5px var(--foreground)'

const GRID = 'grid grid-cols-[16px_repeat(12,minmax(0,1fr))] gap-x-[3px]'

function cellStyle(cell: ConsistencyCell): CSSProperties {
  return { ...FILL[cell.state], ...(cell.today ? { boxShadow: TODAY_RING } : {}) }
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <GlassSurface variant="card" className="rounded-card-sm px-3.5 py-3">
      <div className="text-caption uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-display text-title2 font-bold leading-none tabular-nums text-foreground">{value}</div>
    </GlassSurface>
  )
}

function Day({ cell, onRest }: { cell: ConsistencyCell | null; onRest: (date: string) => void }) {
  if (!cell) return <span aria-hidden className="block h-[9px]" />
  const box = 'block h-[9px] w-full rounded-[2px]'
  const name = `${formatDate(cell.date)}: ${t.consistency.levels[cell.state as 'rest' | 'run' | 'long'] ?? ''}`
  if ((cell.state === 'run' || cell.state === 'long') && cell.activityId) {
    return (
      <Link href={`/activities/${cell.activityId}`} aria-label={name} className={box} style={cellStyle(cell)} data-state={cell.state} />
    )
  }
  if (cell.state === 'rest') {
    return <button type="button" aria-label={name} onClick={() => onRest(cell.date)} className={box} style={cellStyle(cell)} data-state="rest" />
  }
  return <span aria-hidden className={box} style={cellStyle(cell)} data-state={cell.state} />
}

export function ConsistencyMonths({ view }: { view: ConsistencyView }) {
  const c = t.consistency
  const [restDay, setRestDay] = useState<string | null>(null)

  if (view.activeDays === 0) {
    return (
      <GlassSurface variant="card" className="rounded-card-sm border-dashed py-10 text-center">
        <p className="text-sm text-subtle">{c.empty}</p>
      </GlassSurface>
    )
  }

  const legend: { key: string; label: string; style: CSSProperties }[] = [
    { key: 'rest', label: c.levels.rest, style: FILL.rest },
    { key: 'run', label: c.levels.run, style: FILL.run },
    { key: 'long', label: c.levels.long, style: FILL.long },
    { key: 'today', label: c.today, style: { boxShadow: 'inset 0 0 0 1.5px var(--foreground)' } },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label={c.activeDays} value={String(view.activeDays)} />
        <StatTile label={c.share} value={`${view.sharePct}%`} />
        <StatTile label={c.streak} value={c.streakValue(view.streakWeeks)} />
      </div>

      <GlassSurface variant="card" className="rounded-card-sm px-3.5 py-3.5" data-testid="consistency-grid">
        {/* Month initials over their columns; January in text ink marks the new year. */}
        <div className={cn(GRID, 'mb-1.5')} aria-hidden>
          <span />
          {view.months.map((month) => (
            <span
              key={month.key}
              data-testid="consistency-month"
              className={cn('text-center text-caption font-bold', month.startsYear ? 'text-foreground' : 'text-muted-foreground')}
            >
              {month.initial}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-y-[3px]">
          {Array.from({ length: ROWS }, (_, row) => (
            <div key={row} className={GRID}>
              <span aria-hidden className="text-right text-caption leading-[9px] text-muted-foreground" style={{ paddingRight: 3 }}>
                {LABELLED_ROWS.includes(row + 1) ? row + 1 : ''}
              </span>
              {view.months.map((month) => (
                <Day key={month.key} cell={month.cells[row] ?? null} onRest={setRestDay} />
              ))}
            </div>
          ))}
        </div>

        {/* Active days per month, under the grid. */}
        <div className={cn(GRID, 'mt-2.5 border-t border-border pt-2')} data-testid="consistency-counts">
          <span />
          {view.months.map((month) => (
            <span
              key={month.key}
              aria-label={c.monthSummary(month.fullLabel, month.activeDays)}
              className="text-center text-caption font-bold tabular-nums text-foreground"
            >
              {month.activeDays}
            </span>
          ))}
        </div>

        <p aria-live="polite" className="mt-2 min-h-4 text-caption text-muted-foreground" data-testid="consistency-rest-day">
          {restDay ? c.restDay(formatDate(restDay)) : null}
        </p>

        <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-caption text-muted-foreground">
          {legend.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[2px]" style={item.style} />
              {item.label}
            </span>
          ))}
        </div>
      </GlassSurface>
    </div>
  )
}
