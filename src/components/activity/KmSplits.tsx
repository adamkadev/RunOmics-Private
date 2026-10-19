'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cardClass } from '@/components/ui/Card'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { MINUS, formatDuration, formatClock, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { ActivitySplit, SplitLap } from '@/domain/activity/types'
import type { ActivityDetailView } from './activityViews'
import { kmElevationDeltas, kmSplitsOf, type KmSplit } from '@/domain/activity/kmSplits'
import { cleanStream } from '@/domain/activity/cleanStream'
import { smoothStream } from '@/domain/activity/smoothStream'
import { repSet } from '@/domain/activity/repSet'
import { IntervalSet } from './IntervalSet'

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
  return formatKm(distanceM / 1000, 2)
}

// KM 30 · PACE 42 · the speed bar · ±S 34 · ELEV 38 · HR 32 (3.0).
const PER_KM_ROW = 'grid w-full items-center gap-x-2.5 grid-cols-[30px_42px_minmax(0,1fr)_34px_38px_32px]'
const PER_KM_ROW_NO_HR = 'grid w-full items-center gap-x-2.5 grid-cols-[30px_42px_minmax(0,1fr)_34px_38px]'

interface Props {
  activity: ActivityDetailView
}

function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : delta < 0 ? `${MINUS}${Math.abs(delta)}` : '0'
}

type View = 'km' | 'laps'
const VIEWS = ['km', 'laps'] as const

/**
 * A continuous run's kilometres, compared with each other (3.0): a bar per
 * km as long as its speed - the fastest km in the accent with its pace in
 * bold, the others that beat the average in a deeper accent, the slower ones
 * in a neutral - the gap to the average in seconds, in the accent when
 * faster, and the metres climbed, which is what explains a slow km on a hill.
 */
function PerKmRows({ activity, splits }: { activity: ActivityDetailView; splits: KmSplit[] }) {
  const sp = t.activity.splits
  const showHr = splits.some((s) => s.avgHr !== null)
  const rowCls = showHr ? PER_KM_ROW : PER_KM_ROW_NO_HR
  const avgPace = perKmAverage(activity, splits)
  const elevation = kmElevationDeltas(
    splits,
    activity.elevationProfile ? smoothStream(cleanStream(activity.elevationProfile, { spikeFloor: 60 })) : null,
    activity.distanceKm,
  )

  // Bars run from the slowest km (12 %) to the fastest (full), so the
  // differences a few seconds apart can be seen; speed is 1 / pace.
  const speeds = splits.map((s) => 1 / s.paceSecPerKm)
  const lo = Math.min(...speeds)
  const hi = Math.max(...speeds)
  const width = (speed: number) => (hi > lo ? 12 + ((speed - lo) / (hi - lo)) * 88 : 100)
  // A partial last km is not a kilometre to crown.
  const full = splits.filter((s) => s.distanceKm >= 0.99)
  const fastest = full.length > 1 ? full.reduce((a, b) => (b.paceSecPerKm < a.paceSecPerKm ? b : a)).km : null

  return (
    <div className="flex flex-col">
      <div className={`${rowCls} whitespace-nowrap pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground`}>
        <span>{sp.cols.km}</span>
        <span>{sp.cols.pace}</span>
        {/* The bar's column has no visible heading; a reader still hears it. */}
        <span><span className="sr-only">{sp.cols.speed}</span></span>
        <span className="text-right">{sp.cols.vsAvg}</span>
        <span className="text-right">{sp.cols.elev}</span>
        {showHr && <span className="text-right">{sp.cols.hr}</span>}
      </div>

      {splits.map((split, i) => {
        const delta = Math.round(split.paceSecPerKm) - avgPace
        const best = split.km === fastest
        const climb = elevation[i]
        return (
          <div key={split.km} className={`${rowCls} py-[9px] text-sm`} data-testid="km-split" data-fastest={best || undefined}>
            <span className="tabular-nums text-muted-foreground">
              {split.distanceKm < 1 ? formatKm(split.distanceKm, 1) : split.km}
            </span>
            <span className={cn('font-mono tabular-nums text-foreground', best ? 'font-bold' : 'font-medium')}>
              {formatClock(split.paceSecPerKm)}
            </span>
            <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--track)]" aria-hidden="true">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${width(speeds[i]!)}%`,
                  background: best
                    ? 'var(--accent)'
                    : delta < 0
                      ? 'color-mix(in srgb, var(--accent) 62%, var(--card))'
                      : 'var(--line-2)',
                }}
              />
            </span>
            <span className={cn('text-right tabular-nums', delta < 0 ? 'text-accent-text' : 'text-muted-foreground')}>
              {signed(delta)}
            </span>
            <span className="text-right tabular-nums text-muted-foreground" data-testid="km-elev">
              {climb == null ? '-' : signed(climb)}
            </span>
            {showHr && <span className="text-right tabular-nums text-[var(--text-2)]">{split.avgHr ?? '-'}</span>}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The run's average pace in whole seconds, as the header prints it, and each
 * split is rounded the same way before the subtraction: a 4:04 km against a
 * 4:10 average reads -6, not -5.
 */
function perKmAverage(activity: ActivityDetailView, splits: KmSplit[]): number {
  const distanceKm = splits.reduce((s, x) => s + x.distanceKm, 0)
  const durationSec = splits.reduce((s, x) => s + x.durationSec, 0)
  return Math.round(activity.paceSecPerKm ?? durationSec / distanceKm)
}

/** The watch's laps or the session's intervals, a row each, with a total. */
function LapTable({ splits, bare = false }: { splits: ActivitySplit[]; bare?: boolean }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
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
    <section className={bare ? 'flex flex-col gap-3' : cardClass({ className: 'flex flex-col gap-3' })}>
      {!bare && (
        <h3 className="text-[15px] font-semibold text-foreground">
          {lapsOnly ? t.activity.splits.lapTitle : t.activity.splits.title}
        </h3>
      )}

      <div className="w-full space-y-0.5">
        <div className={`${rowCls} pb-1.5 text-caption uppercase tracking-[0.06em] text-muted-foreground`}>
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
                  className={`${rowCls} rounded-md px-1 py-1.5 transition-colors ${hasSubLaps ? 'cursor-pointer hover:bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]'}`}
                  onClick={hasSubLaps ? () => toggle(i) : undefined}
                >
                  <span className="flex items-center text-xs font-semibold tabular-nums text-muted-foreground">
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
                    <span className="pl-1 text-xs tabular-nums text-muted-foreground">{j + 1}</span>
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

        <div className={`${rowCls} border-t border-[var(--line-2)] px-1 pb-1 pt-2.5`}>
          <span className="text-xs text-subtle">--</span>
          <span className="text-xs font-semibold text-foreground">{t.activity.splits.cols.total}</span>
          <span className="text-xs font-semibold tabular-nums">{formatDuration(totalDurationSec)}</span>
          <span className="text-xs font-semibold tabular-nums">{distStr(totalDistanceM)}</span>
          <span className="text-xs font-semibold tabular-nums">{paceStr(totalAvgSpeedMs)}</span>
          {showHr && <span className="text-xs font-semibold tabular-nums">{totalAvgHr ?? '-'}</span>}
        </div>
      </div>
    </section>
  )
}

/**
 * Splits (3.0): a run of laps opens on its kilometres, with Km / Laps to
 * switch to the watch's own laps and the run's average pace on the right. A
 * structured session keeps its rep set or its interval table.
 */
export function KmSplits({ activity }: Props) {
  const [view, setView] = useState<View>('km')
  const viewTabs = useSegmentedTabs<View>({ ids: VIEWS, value: view, onChange: setView })
  const splits = activity.splits

  if (!splits || splits.length === 0) return null

  const set = repSet(splits)
  if (set) return <IntervalSet set={set} />
  if (!splits.every((s) => s.type === 'lap')) return <LapTable splits={splits} />

  // One lap is the whole run: its auto laps are the laps to show.
  const laps: ActivitySplit[] =
    splits.length > 1 ? splits : (splits[0]?.laps ?? []).map((lap) => ({ type: 'lap', ...lap, laps: [] }))
  const perKm = kmSplitsOf({
    laps,
    distanceKm: activity.distanceKm,
    durationSec: activity.durationSeconds,
    paceSamples: activity.paceSamples,
    hrSamples: activity.hrSamples,
    avgPaceSecPerKm: activity.paceSecPerKm,
  })
  const hasKm = perKm.length > 1
  const hasLaps = laps.length > 1

  if (!hasKm) return <LapTable splits={hasLaps ? laps : splits} />

  const sp = t.activity.splits
  const shown: View = hasLaps ? view : 'km'
  return (
    <section className="flex flex-col gap-3" data-testid="splits">
      <div className="flex items-center justify-between gap-3">
        {hasLaps ? (
          <SegmentedTabs
            tabs={viewTabs}
            label={sp.viewLabel}
            items={[
              { id: 'km', label: sp.cols.km },
              { id: 'laps', label: sp.lapTitle },
            ]}
            tabClassName="h-[28px] px-3 text-[13px]"
          />
        ) : (
          <span />
        )}
        <span className="text-[13px] text-muted-foreground" data-testid="splits-avg">
          {sp.avg(formatClock(perKmAverage(activity, perKm)))}
        </span>
      </div>
      <div {...(hasLaps ? viewTabs.panelProps : {})} className="outline-none">
        {shown === 'km' ? <PerKmRows activity={activity} splits={perKm} /> : <LapTable splits={laps} bare />}
      </div>
    </section>
  )
}
