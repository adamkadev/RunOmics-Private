'use client'

import { useState } from 'react'
import { Timer, ChevronRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDuration, formatClock } from '@/lib/formatters'
import { t } from '@/i18n'
import type { Activity, ActivitySplit, SplitLap } from '@/domain/activity/types'

const TYPE_COLORS: Record<string, string> = {
  interval_warmup:   'text-blue-500 dark:text-blue-400',
  interval_active:   'text-accent-text',
  interval_rest:     'text-muted-foreground',
  interval_recovery: 'text-muted-foreground',
  interval_cooldown: 'text-violet-500 dark:text-violet-400',
}

// Two static strings so Tailwind JIT can detect both variants
const ROW_NO_HR = 'grid w-full items-center gap-x-3 grid-cols-[1.5rem_1fr_4rem_3.5rem_3.5rem]'
const ROW_HR = 'grid w-full items-center gap-x-3 grid-cols-[1.5rem_1fr_4rem_3.5rem_3.5rem] sm:grid-cols-[1.5rem_1fr_4.5rem_3.5rem_4rem_2.5rem]'

function paceStr(avgSpeedMs: number): string {
  if (avgSpeedMs <= 0) return '-'
  return formatClock(Math.round(1000 / avgSpeedMs))
}

function distStr(distanceM: number): string {
  return (distanceM / 1000).toFixed(2)
}

interface Props {
  activity: Activity
}

export function KmSplits({ activity }: Props) {
  const splits = activity.splits
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  if (!splits || splits.length === 0) return null

  const showHr = splits.some((s) => s.avgHr !== null)
  const rowCls = showHr ? ROW_HR : ROW_NO_HR

  function toggle(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) { next.delete(i) } else { next.add(i) }
      return next
    })
  }

  const totalDurationSec = splits.reduce((s, sp) => s + sp.durationSec, 0)
  const totalDistanceM = splits.reduce((s, sp) => s + sp.distanceM, 0)
  const totalAvgSpeedMs = totalDistanceM > 0 ? totalDistanceM / totalDurationSec : 0
  const totalAvgHr = showHr
    ? Math.round(splits.filter((s) => s.avgHr).reduce((s, sp) => s + (sp.avgHr ?? 0) * sp.durationSec, 0) / totalDurationSec)
    : null

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-[18px]">
      <div className="mb-4 flex items-center gap-2">
        <Timer size={16} className="text-accent-text" />
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.splits.title}</h3>
      </div>

      <div className="w-full space-y-0.5">
        {/* Header */}
        <div className={`${rowCls} pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle`}>
          <span>{t.activity.splits.cols.step}</span>
          <span>{t.activity.splits.cols.type}</span>
          <span>{t.activity.splits.cols.duration}</span>
          <span>{t.activity.splits.cols.dist}</span>
          <span>{t.activity.splits.cols.pace}</span>
          {showHr && <span className="hidden sm:block">{t.activity.splits.cols.hr}</span>}
        </div>

        {(() => {
          let splitNum = 0
          return splits.map((split: ActivitySplit, i: number) => {
            const isActive = split.type === 'interval_active'
            if (isActive) splitNum++
            const typeLabel = t.activity.splits.intervalTypes[split.type] ?? split.type
            const typeColor = TYPE_COLORS[split.type] ?? 'text-foreground'
            const hasSubLaps = isActive && split.laps.length >= 2
            const isOpen = expanded.has(i)

            if (!isActive) {
              return (
                <div key={i} className={`${rowCls} rounded-md px-1 py-1.5`}>
                  <span />
                  <span className={`truncate text-sm font-semibold ${typeColor}`}>{typeLabel}</span>
                  <span className="text-sm tabular-nums">{formatDuration(split.durationSec)}</span>
                  <span className="text-sm tabular-nums">{distStr(split.distanceM)}</span>
                  <span className="text-sm tabular-nums">{paceStr(split.avgSpeedMs)}</span>
                  {showHr && <span className="hidden text-sm tabular-nums sm:block">{split.avgHr ?? '-'}</span>}
                </div>
              )
            }

            return (
              <div key={i}>
                <div
                  className={`${rowCls} rounded-md px-1 py-1.5 transition-colors ${hasSubLaps ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/40'}`}
                  onClick={hasSubLaps ? () => toggle(i) : undefined}
                >
                  <span className="flex items-center text-sm font-semibold tabular-nums text-foreground/60">
                    {splitNum}
                    {hasSubLaps && (
                      <ChevronRight
                        size={12}
                        className={`ml-0.5 shrink-0 text-subtle transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                      />
                    )}
                  </span>
                  <span className={`truncate text-sm font-semibold ${typeColor}`}>{typeLabel}</span>
                  <span className="text-sm tabular-nums">{formatDuration(split.durationSec)}</span>
                  <span className="text-sm tabular-nums">{distStr(split.distanceM)}</span>
                  <span className="text-sm tabular-nums">{paceStr(split.avgSpeedMs)}</span>
                  {showHr && <span className="hidden text-sm tabular-nums sm:block">{split.avgHr ?? '-'}</span>}
                </div>

                {hasSubLaps && isOpen && split.laps.map((lap: SplitLap, j: number) => (
                  <div key={j} className={`${rowCls} rounded-md px-1 py-1.5`}>
                    <span className="pl-1 text-sm tabular-nums text-foreground/60">{j + 1}</span>
                    <span className={`truncate text-sm font-semibold ${typeColor}`}>{typeLabel}</span>
                    <span className="text-sm tabular-nums">{formatDuration(lap.durationSec)}</span>
                    <span className="text-sm tabular-nums">{distStr(lap.distanceM)}</span>
                    <span className="text-sm tabular-nums">{paceStr(lap.avgSpeedMs)}</span>
                    {showHr && <span className="hidden text-sm tabular-nums sm:block">{lap.avgHr ?? '-'}</span>}
                  </div>
                ))}
              </div>
            )
          })
        })()}

        {/* Summary */}
        <div className={`${rowCls} border-t border-border px-1 pb-1 pt-2.5`}>
          <span className="text-sm text-subtle">--</span>
          <span className="text-sm font-semibold text-foreground/70">{t.activity.splits.cols.total}</span>
          <span className="text-sm font-semibold tabular-nums">{formatDuration(totalDurationSec)}</span>
          <span className="text-sm font-semibold tabular-nums">{distStr(totalDistanceM)}</span>
          <span className="text-sm font-semibold tabular-nums">{paceStr(totalAvgSpeedMs)}</span>
          {showHr && <span className="hidden text-sm font-semibold tabular-nums sm:block">{totalAvgHr ?? '-'}</span>}
        </div>
      </div>
    </GlassSurface>
  )
}
