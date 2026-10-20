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
import { EVEN_SPLIT_SEC, halfSplitSec, kmElevationDeltas, kmSplitsOf, type KmSplit } from '@/domain/activity/kmSplits'
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

/** A supporting cell of a lap row: the numbers that are not the duration. */
const MUTED_CELL = 'text-xs tabular-nums text-[var(--text-2)]'

function paceStr(avgSpeedMs: number): string {
  if (avgSpeedMs <= 0) return '-'
  return formatClock(Math.round(1000 / avgSpeedMs))
}

function distStr(distanceM: number): string {
  return formatKm(distanceM / 1000, 2)
}

// KM 30 · PACE 44 · the pace bar · ELEV 38 · HR 34 (3.0.2, 5c).
const PER_KM_ROW = 'grid w-full items-center gap-x-2 grid-cols-[30px_44px_minmax(0,1fr)_38px_34px]'
const PER_KM_ROW_NO_HR = 'grid w-full items-center gap-x-2 grid-cols-[30px_44px_minmax(0,1fr)_38px]'

interface Props {
  activity: ActivityDetailView
}

function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : delta < 0 ? `${MINUS}${Math.abs(delta)}` : '0'
}

type View = 'km' | 'laps'
const VIEWS = ['km', 'laps'] as const

/**
 * A session with a structure to read (3.0.2): a warm-up, a recovery or a
 * cool-down, or more than one work interval. A run the watch kept as one
 * interval - a long run started from a workout - is a steady run.
 */
export function isStructured(splits: readonly ActivitySplit[]): boolean {
  if (splits.some((s) => s.type !== 'lap' && s.type !== 'interval_active')) return true
  return splits.filter((s) => s.type === 'interval_active').length > 1
}

/** The fastest whole kilometre, the one the accent marks; a partial last km is not one to crown. */
function fastestKm(splits: KmSplit[]): KmSplit | null {
  const full = splits.filter((s) => s.distanceKm >= 0.99)
  return full.length > 1 ? full.reduce((a, b) => (b.paceSecPerKm < a.paceSecPerKm ? b : a)) : null
}

/** "Negative split −0:20": the second half against the first, even within a few seconds. */
function splitVerdict(splits: KmSplit[]): string | null {
  const sp = t.activity.splits
  const delta = halfSplitSec(splits)
  if (delta === null) return null
  if (Math.abs(delta) < EVEN_SPLIT_SEC) return sp.evenSplit
  const gap = `${delta < 0 ? MINUS : '+'}${formatClock(Math.abs(delta))}`
  return delta < 0 ? sp.negativeSplit(gap) : sp.positiveSplit(gap)
}

/**
 * A continuous run's kilometres, compared with each other (3.0.2, 5c): a bar
 * per km as long as its speed - the fastest km the full bar, as the mockup
 * draws it and 3.0's "bar length ∝ speed" set it, so a drift reads at a
 * glance - the fastest km in the accent, its pace too, the metres
 * climbed, which is what explains a slow km on a hill, and the heart rate.
 * The footer names the fastest km and how the second half went.
 */
function PerKmRows({ activity, splits }: { activity: ActivityDetailView; splits: KmSplit[] }) {
  const sp = t.activity.splits
  const showHr = splits.some((s) => s.avgHr !== null)
  const rowCls = showHr ? PER_KM_ROW : PER_KM_ROW_NO_HR
  const elevation = kmElevationDeltas(
    splits,
    activity.elevationProfile ? smoothStream(cleanStream(activity.elevationProfile, { spikeFloor: 60 })) : null,
    activity.distanceKm,
  )

  // Bars run from the fastest km (12 %) to the slowest (full), so the
  // differences a few seconds apart can be seen.
  const paces = splits.map((s) => s.paceSecPerKm)
  const lo = Math.min(...paces)
  const hi = Math.max(...paces)
  const width = (pace: number) => (hi > lo ? 12 + ((hi - pace) / (hi - lo)) * 88 : 100)
  const fastest = fastestKm(splits)
  const verdict = splitVerdict(splits)

  return (
    <div className="flex flex-col">
      <div className={`${rowCls} whitespace-nowrap pb-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground`}>
        <span>{sp.cols.km}</span>
        <span>{sp.cols.pace}</span>
        {/* The bar restates the pace beside it: no heading of its own. */}
        <span />
        <span className="text-right">{sp.cols.elev}</span>
        {showHr && <span className="text-right">{sp.cols.hr}</span>}
      </div>

      {splits.map((split, i) => {
        const best = split.km === fastest?.km
        const climb = elevation[i]
        return (
          <div key={split.km} className={`${rowCls} py-[7px] text-sm`} data-testid="km-split" data-fastest={best || undefined}>
            <span className="tabular-nums text-muted-foreground">
              {split.distanceKm < 1 ? formatKm(split.distanceKm, 1) : split.km}
            </span>
            <span className={cn('font-mono font-medium tabular-nums', best ? 'text-accent-text' : 'text-foreground')}>
              {formatClock(split.paceSecPerKm)}
            </span>
            <span className="block h-2 overflow-hidden rounded-full bg-[var(--track)]" aria-hidden="true">
              <span
                className="block h-full rounded-full"
                data-testid="km-bar"
                style={{ width: `${width(paces[i]!)}%`, background: best ? 'var(--accent)' : 'var(--line-2)' }}
              />
            </span>
            <span className="text-right tabular-nums text-muted-foreground" data-testid="km-elev">
              {climb == null ? '-' : signed(climb)}
            </span>
            {showHr && <span className="text-right tabular-nums text-[var(--text-2)]">{split.avgHr ?? '-'}</span>}
          </div>
        )
      })}

      {(fastest || verdict) && (
        <div
          className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-border pt-2.5 text-xs text-muted-foreground"
          data-testid="splits-footer"
        >
          <span data-testid="fastest-km">
            {fastest && (
              <>
                {sp.fastest}{' '}
                <b className="font-semibold text-accent-text">{sp.fastestKm(fastest.km, formatClock(fastest.paceSecPerKm))}</b>
              </>
            )}
          </span>
          {verdict && <span data-testid="split-verdict">{verdict}</span>}
        </div>
      )}
    </div>
  )
}

/**
 * A run the watch kept as a single lap (App Fixes 1c): nobody pressed the
 * lap button, so there are no laps to list. It says so and offers the
 * kilometres instead - it used to draw one row headed "Intervals" and typed
 * "Interval", which named a session the run never was.
 */
function WholeRunLap({ split, bare = false, onKmSplits }: { split: ActivitySplit; bare?: boolean; onKmSplits?: () => void }) {
  const sp = t.activity.splits
  const showHr = split.avgHr !== null
  const rowCls = showHr ? ROW_HR : ROW_NO_HR
  return (
    <section className={bare ? 'flex flex-col gap-3' : cardClass({ className: 'flex flex-col gap-3' })} data-testid="whole-run-lap">
      {!bare && <h3 className="text-[15px] font-semibold text-foreground">{sp.lapTitle}</h3>}
      <div className="w-full space-y-0.5">
        <div className={`${rowCls} pb-1.5 text-caption uppercase tracking-[0.06em] text-muted-foreground`}>
          <span className="truncate">{sp.cols.step}</span>
          <span className="truncate">{sp.cols.type}</span>
          <span className="truncate">{sp.cols.duration}</span>
          <span className="truncate">{sp.cols.dist}</span>
          <span className="truncate">{sp.cols.pace}</span>
          {showHr && <span className="truncate">{sp.cols.hr}</span>}
        </div>
        <div className={`${rowCls} rounded-md px-1 py-1.5`}>
          <span />
          <span className="truncate text-xs font-semibold text-foreground">{sp.wholeRun}</span>
          <span className="text-xs tabular-nums">{formatDuration(split.durationSec)}</span>
          <span className={MUTED_CELL}>{distStr(split.distanceM)}</span>
          <span className={MUTED_CELL}>{paceStr(split.avgSpeedMs)}</span>
          {showHr && <span className={MUTED_CELL}>{split.avgHr ?? '-'}</span>}
        </div>
      </div>
      <p className="text-xs leading-snug text-muted-foreground text-pretty">
        {sp.noLapsPressed}{' '}
        {onKmSplits && (
          <button type="button" onClick={onKmSplits} className="inline-flex items-center gap-0.5 font-medium text-accent-text">
            {sp.seeKmSplits}
            <ChevronRight size={13} strokeWidth={2.2} aria-hidden className="shrink-0" />
          </button>
        )}
      </p>
    </section>
  )
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
 * Splits (3.0.2, 5c): one card, the run's kilometres and its laps behind
 * Km / Laps when it has both. A steady run opens on its kilometres, a
 * structured session on its laps - its rep set or its interval table. A run
 * with no kilometres to rebuild keeps its laps alone.
 */
export function KmSplits({ activity }: Props) {
  const splits = activity.splits
  const [view, setView] = useState<View>(splits && isStructured(splits) ? 'laps' : 'km')
  const viewTabs = useSegmentedTabs<View>({ ids: VIEWS, value: view, onChange: setView })

  if (!splits || splits.length === 0) return null

  const set = repSet(splits)
  const lapsOnly = splits.every((s) => s.type === 'lap')
  // One lap or one interval is the whole run: its auto laps are its laps,
  // and what its kilometres are read from.
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
  // A run of laps lists them; a session keeps its own rows - the one
  // interval a run was started as, its auto laps folded under it.
  const lapRows = lapsOnly ? laps : splits
  const hasLaps = set !== null || lapRows.length > 1 || (lapRows[0]?.laps.length ?? 0) > 1
  // One lap and no rep set: the watch recorded the run whole (App Fixes 1c).
  const wholeRun = set === null && lapRows.length === 1 ? lapRows[0]! : null
  const lapsView = set ? (
    <IntervalSet set={set} bare={hasKm} />
  ) : wholeRun ? (
    <WholeRunLap split={wholeRun} bare={hasKm} onKmSplits={hasKm ? () => setView('km') : undefined} />
  ) : (
    <LapTable splits={lapRows.length > 1 ? lapRows : splits} bare={hasKm} />
  )

  if (!hasKm) return lapsView

  const sp = t.activity.splits
  const shown: View = hasLaps ? view : 'km'
  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="splits">
      <div className="flex min-h-[30px] items-center justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-foreground">{t.activity.tabs.intervals}</h3>
        {hasLaps && (
          <SegmentedTabs
            tabs={viewTabs}
            label={sp.viewLabel}
            items={[
              { id: 'km', label: sp.cols.km },
              { id: 'laps', label: sp.lapTitle },
            ]}
            tabClassName="h-[28px] px-3 text-[13px]"
          />
        )}
      </div>
      <div {...(hasLaps ? viewTabs.panelProps : {})} className="outline-none">
        {shown === 'km' ? <PerKmRows activity={activity} splits={perKm} /> : lapsView}
      </div>
    </section>
  )
}
