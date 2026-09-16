'use client'

import { useState } from 'react'
import { Timer, ChevronRight } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDuration, formatClock } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { Activity, ActivitySplit, SplitLap } from '@/domain/activity/types'
import { kmSplitsFromSamples, type KmSplit } from '@/domain/activity/kmSplits'

/**
 * The same four segment kinds are coloured by WORKOUT_SEGMENT_COLORS on the
 * plan's structure bar, and the two disagreed: blue meant "warm-up" here and
 * "recovery" there, two taps apart on one activity, while cool-down spent a
 * violet nothing else in the app uses. The structure bar draws warm-up and
 * cool-down as the same neutral, so they share one here too, and the cool tone
 * goes back to the segments it names. Each row prints its own segment label,
 * so the ink ranks the segments rather than identifying them.
 */
const TYPE_COLORS: Record<string, string> = {
  interval_warmup:   'text-subtle',
  interval_active:   'text-accent-text',
  interval_rest:     'text-blue-600 dark:text-blue-400',
  interval_recovery: 'text-blue-600 dark:text-blue-400',
  interval_cooldown: 'text-subtle',
  lap:               'text-accent-text',
}

const NUMBERED_TYPES = new Set(['interval_active', 'lap'])

const ROW_NO_HR = 'grid w-full items-center gap-x-1.5 grid-cols-[1.1rem_1fr_3rem_2.5rem_2.75rem]'
const ROW_HR = 'grid w-full items-center gap-x-1.5 grid-cols-[1.1rem_1fr_3rem_2.5rem_2.75rem_1.75rem]'

function paceStr(avgSpeedMs: number): string {
  if (avgSpeedMs <= 0) return '-'
  return formatClock(Math.round(1000 / avgSpeedMs))
}

function distStr(distanceM: number): string {
  return (distanceM / 1000).toFixed(2)
}

const PER_KM_ROW_NO_HR = 'grid w-full items-center gap-x-1.5 grid-cols-[1fr_3.5rem]'
const PER_KM_ROW_HR = 'grid w-full items-center gap-x-1.5 grid-cols-[1fr_3.5rem_3rem]'

interface Props {
  activity: Activity
}

function PerKmSplits({ activity, splits }: { activity: Activity; splits: KmSplit[] }) {
  const showHr = splits.some((s) => s.avgHr !== null)
  const rowCls = showHr ? PER_KM_ROW_HR : PER_KM_ROW_NO_HR
  const totalDistanceKm = splits.reduce((s, sp) => s + sp.distanceKm, 0)
  const totalDurationSec = splits.reduce((s, sp) => s + sp.durationSec, 0)
  const fastest = Math.min(...splits.map((s) => s.paceSecPerKm))

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Timer size={16} className="text-accent-text" />
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.splits.perKmTitle}</h3>
      </div>
      <p className="mb-4 text-caption text-subtle">{t.activity.splits.continuous}</p>

      <div className="w-full space-y-0.5">
        <div className={`${rowCls} pb-1.5 text-micro font-semibold uppercase tracking-wide text-subtle`}>
          <span className="truncate">{t.activity.splits.cols.km}</span>
          <span className="truncate">{t.activity.splits.cols.pace}</span>
          {showHr && <span className="truncate">{t.activity.splits.cols.hr}</span>}
        </div>

        {splits.map((split) => (
          <div key={split.km} className={`${rowCls} rounded-md px-1 py-1.5`}>
            <span className="truncate text-xs font-semibold tabular-nums text-foreground/60">
              {split.distanceKm < 1
                ? t.activity.splits.partialKm(split.distanceKm.toFixed(2))
                : split.km}
            </span>
            <span
              className={cn(
                'text-xs tabular-nums',
                split.paceSecPerKm === fastest && 'font-semibold text-accent-text',
              )}
            >
              {formatClock(split.paceSecPerKm)}
            </span>
            {showHr && <span className="text-xs tabular-nums">{split.avgHr ?? '-'}</span>}
          </div>
        ))}

        <div className={`${rowCls} border-t border-border px-1 pb-1 pt-2.5`}>
          <span className="truncate text-xs font-semibold text-foreground/70">
            {t.activity.splits.cols.total}
          </span>
          <span className="text-xs font-semibold tabular-nums">
            {formatClock(activity.paceSecPerKm ?? Math.round(totalDurationSec / totalDistanceKm))}
          </span>
          {showHr && (
            <span className="text-xs font-semibold tabular-nums">{activity.avgHeartRate ?? '-'}</span>
          )}
        </div>
      </div>
    </GlassSurface>
  )
}

export function KmSplits({ activity }: Props) {
  const splits = activity.splits
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  if (!splits || splits.length === 0) return null

  if (splits.length <= 1) {
    const perKm = kmSplitsFromSamples({
      distanceKm: activity.distanceKm,
      durationSec: activity.durationSeconds,
      paceSamples: activity.paceSamples,
      hrSamples: activity.hrSamples,
      avgPaceSecPerKm: activity.paceSecPerKm,
    })
    if (perKm.length > 1) return <PerKmSplits activity={activity} splits={perKm} />
  }

  const showHr = splits.some((s) => s.avgHr !== null)
  const rowCls = showHr ? ROW_HR : ROW_NO_HR
  const lapsOnly = splits.every((s) => s.type === 'lap')

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
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Timer size={16} className="text-accent-text" />
        <h3 className="text-sm font-semibold text-foreground/80">
          {lapsOnly ? t.activity.splits.lapTitle : t.activity.splits.title}
        </h3>
      </div>

      <div className="w-full space-y-0.5">
        <div className={`${rowCls} pb-1.5 text-micro font-semibold uppercase tracking-wide text-subtle`}>
          <span className="truncate">{t.activity.splits.cols.step}</span>
          <span className="truncate">{t.activity.splits.cols.type}</span>
          <span className="truncate">{t.activity.splits.cols.duration}</span>
          <span className="truncate">{t.activity.splits.cols.dist}</span>
          <span className="truncate">{t.activity.splits.cols.pace}</span>
          {showHr && <span className="truncate">{t.activity.splits.cols.hr}</span>}
        </div>

        {(() => {
          let splitNum = 0
          return splits.map((split: ActivitySplit, i: number) => {
            const isNumbered = NUMBERED_TYPES.has(split.type)
            if (isNumbered) splitNum++
            const typeLabel = t.activity.splits.intervalTypes[split.type] ?? split.type
            const typeColor = TYPE_COLORS[split.type] ?? 'text-foreground'
            const hasSubLaps = isNumbered && split.laps.length >= 2
            const isOpen = expanded.has(i)

            if (!isNumbered) {
              return (
                <div key={i} className={`${rowCls} rounded-md px-1 py-1.5`}>
                  <span />
                  <span className={`truncate text-xs font-semibold ${typeColor}`}>{typeLabel}</span>
                  <span className="text-xs tabular-nums">{formatDuration(split.durationSec)}</span>
                  <span className="text-xs tabular-nums">{distStr(split.distanceM)}</span>
                  <span className="text-xs tabular-nums">{paceStr(split.avgSpeedMs)}</span>
                  {showHr && <span className="text-xs tabular-nums">{split.avgHr ?? '-'}</span>}
                </div>
              )
            }

            return (
              <div key={i}>
                <div
                  className={`${rowCls} rounded-md px-1 py-1.5 transition-colors ${hasSubLaps ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/40'}`}
                  onClick={hasSubLaps ? () => toggle(i) : undefined}
                >
                  <span className="flex items-center text-xs font-semibold tabular-nums text-foreground/60">
                    {splitNum}
                    {hasSubLaps && (
                      <ChevronRight
                        size={12}
                        className={`ml-0.5 shrink-0 text-subtle transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                      />
                    )}
                  </span>
                  <span className={`truncate text-xs font-semibold ${typeColor}`}>{typeLabel}</span>
                  <span className="text-xs tabular-nums">{formatDuration(split.durationSec)}</span>
                  <span className="text-xs tabular-nums">{distStr(split.distanceM)}</span>
                  <span className="text-xs tabular-nums">{paceStr(split.avgSpeedMs)}</span>
                  {showHr && <span className="text-xs tabular-nums">{split.avgHr ?? '-'}</span>}
                </div>

                {hasSubLaps && isOpen && split.laps.map((lap: SplitLap, j: number) => (
                  <div key={j} className={`${rowCls} rounded-md px-1 py-1.5`}>
                    <span className="pl-1 text-xs tabular-nums text-foreground/60">{j + 1}</span>
                    <span className={`truncate text-xs font-semibold ${typeColor}`}>{typeLabel}</span>
                    <span className="text-xs tabular-nums">{formatDuration(lap.durationSec)}</span>
                    <span className="text-xs tabular-nums">{distStr(lap.distanceM)}</span>
                    <span className="text-xs tabular-nums">{paceStr(lap.avgSpeedMs)}</span>
                    {showHr && <span className="text-xs tabular-nums">{lap.avgHr ?? '-'}</span>}
                  </div>
                ))}
              </div>
            )
          })
        })()}

        <div className={`${rowCls} border-t border-border px-1 pb-1 pt-2.5`}>
          <span className="text-xs text-subtle">--</span>
          <span className="text-xs font-semibold text-foreground/70">{t.activity.splits.cols.total}</span>
          <span className="text-xs font-semibold tabular-nums">{formatDuration(totalDurationSec)}</span>
          <span className="text-xs font-semibold tabular-nums">{distStr(totalDistanceM)}</span>
          <span className="text-xs font-semibold tabular-nums">{paceStr(totalAvgSpeedMs)}</span>
          {showHr && <span className="text-xs font-semibold tabular-nums">{totalAvgHr ?? '-'}</span>}
        </div>
      </div>
    </GlassSurface>
  )
}
