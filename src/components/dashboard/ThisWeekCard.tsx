'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { weeklyTargetKm, type WeekTarget } from '@/domain/training/weekTarget'
import { formatRanKm, formatPlannedKm } from '@/lib/formatters'
import { useToday } from '@/lib/useToday'
import { useSkippedDays } from '@/lib/skippedDays'
import type { SkipReason } from '@/domain/wellness/checkIn'
import { cardClass } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { sessionZone, zoneColor } from '@/lib/colors'
import type { ActivityType } from '@/domain/activity/types'
import { weekStripDays, type WeekStripDay } from './weekStrip'
import { t } from '@/i18n'

const TRACK_PX = 90
const MAX_BAR_PX = 66
const MIN_BAR_PX = 8

interface Bar {
  day: WeekStripDay
  /** In px. */
  height: number
  label: string | null
}

export function thisWeekBars(target: WeekTarget, today: string, kinds: Record<string, string>, skipped: ReadonlyMap<string, SkipReason> = new Map()): Bar[] {
  // A missed day marked skipped in Plan is a rest day here.
  const strip = weekStripDays(target.days, today, kinds).map((day) => (day.state === 'missed' && skipped.has(day.date) ? { ...day, state: 'rest' as const } : day))
  const peak = Math.max(1, ...target.days.map((day) => Math.max(day.ranKm, day.plannedKm ?? 0)))
  const px = (km: number) => Math.max(MIN_BAR_PX, Math.round((km / peak) * MAX_BAR_PX))
  return target.days.map((source, i) => {
    const day = strip[i]!
    // A day without a run draws nothing: a stub would read as a very short run.
    if (day.state === 'rest') return { day, height: 0, label: null }
    if (day.state === 'done') return source.runs > 0 ? { day, height: px(source.ranKm), label: formatPlannedKm(source.ranKm) } : { day, height: 0, label: null }
    const km = source.plannedKm ?? 0
    // A missed day keeps its km over the amber bar, so it says what was missed.
    return { day, height: px(km), label: km > 0 ? formatPlannedKm(km) : null }
  })
}

/** Named as the day strip names them. */
const TYPE_KIND: Record<ActivityType, keyof typeof t.dashboard.weeklyStreak.kinds> = {
  Base: 'easy',
  Tempo: 'tempo',
  Threshold: 'threshold',
  VO2Max: 'vo2max',
  Anaerobic: 'anaerobic',
  Sprint: 'sprint',
  Race: 'race',
}

export interface LegendEntry {
  color: string
  label: string
}

export function weekLegend(target: WeekTarget, bars: Bar[]): LegendEntry[] {
  const byZone = new Map<number, Set<string>>()
  target.days.forEach((source, i) => {
    const state = bars[i]?.day.state
    if (state !== 'done' && state !== 'planned') return
    const zone = sessionZone(source)
    const names = byZone.get(zone) ?? new Set<string>()
    names.add(t.dashboard.weeklyStreak.kinds[TYPE_KIND[source.type ?? 'Base'] ?? 'easy'])
    byZone.set(zone, names)
  })
  return [...byZone.entries()]
    .sort(([a], [b]) => a - b)
    .map(([zone, names]) => ({ color: zoneColor(zone as 1 | 2 | 3 | 4 | 5), label: [...names].join(' / ') }))
}

function barStyle({ day, height }: Bar): CSSProperties {
  switch (day.state) {
    case 'rest':
      return { height }
    case 'done':
      return { height, background: day.color, borderRadius: 10 }
    case 'missed':
      return { height, border: '1.5px dashed var(--warn)', borderRadius: 10 }
    default:
      return {
        height,
        border: `1.5px dashed ${day.color}`,
        borderRadius: 10,
      }
  }
}

export function ThisWeekCard({
  target,
  today: serverToday,
  sessionKinds = {},
}: {
  target: WeekTarget
  today: string
  sessionKinds?: Record<string, string>
}) {
  const s = t.dashboard.thisWeek
  const today = useToday(serverToday)
  const skipped = useSkippedDays()
  const bars = thisWeekBars(target, today, sessionKinds, skipped)
  const targetKm = weeklyTargetKm(target)
  const left = target.days.filter((day) => day.state === 'planned').reduce((sum, day) => sum + day.plannedSessions, 0)
  const missed = bars.filter((bar) => bar.day.state === 'missed').length
  const legend = weekLegend(target, bars)

  return (
    // The card opens Plan › Week; a missed bar opens its own day, above it.
    <section className={cardClass({ className: 'relative flex flex-col gap-3.5' })} data-testid="this-week-card">
      <Link href="/plan?view=week" aria-label={t.plan.openPlanner} className="absolute inset-0 rounded-[24px] active:bg-[var(--fill-4)]" data-testid="this-week-link" />
      <div className="pointer-events-none relative flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-headline text-foreground">{s.title}</h2>
        <p className="text-[13px] tabular-nums text-text-2">
          <b className="font-semibold text-foreground">{formatRanKm(target.ranKm)}</b>
          {targetKm !== null ? ` / ${formatPlannedKm(targetKm)} ${t.units.km}` : ` ${t.units.km}`}
        </p>
      </div>

      {/* Read before the bars, on one line: the key and what is left this week. */}
      <div className="pointer-events-none relative flex items-start gap-x-3.5 whitespace-nowrap text-[13px] text-muted-foreground">
        {/* A week of many session types wraps its key rather than push the count off the card. */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1">
          {legend.map((entry) => (
            <span key={entry.color} className="flex items-center gap-[5px]" data-testid="legend-type">
              <span aria-hidden className="size-[9px] rounded-[2px]" style={{ background: entry.color }} />
              {entry.label}
            </span>
          ))}
        </span>
        {(left > 0 || missed > 0) && (
          <span className="ml-auto shrink-0 whitespace-nowrap text-text-2" data-testid="week-footer-count">
            {left > 0 && s.runsLeft(left)}
            {left > 0 && missed > 0 && ' · '}
            {missed > 0 && <span className="text-[var(--warn)]">{s.missedCount(missed)}</span>}
          </span>
        )}
      </div>

      <ul className="pointer-events-none relative grid grid-cols-7 items-end gap-2" style={{ height: TRACK_PX }} data-testid="week-bars">
        {bars.map((bar) => {
          const isMissed = bar.day.state === 'missed'
          const content = (
            <>
              {bar.label && (
                <span
                  aria-hidden
                  className={cn('text-center text-[13px] font-semibold tabular-nums', isMissed ? 'text-[var(--warn)]' : bar.day.isToday ? 'text-foreground' : 'text-text-2')}
                >
                  {bar.label}
                </span>
              )}
              <span aria-hidden className="relative box-border block" data-state={bar.day.state} data-testid="week-bar" style={barStyle(bar)}>
                {bar.day.isToday && bar.day.state === 'planned' && (
                  <span className="absolute inset-0 rounded-[3.5px] opacity-[0.12]" data-testid="today-tint" style={{ background: bar.day.color }} />
                )}
              </span>
            </>
          )
          return (
            <li key={bar.day.date} aria-label={isMissed ? undefined : bar.day.label} className="flex min-w-0 flex-col items-stretch gap-1">
              {isMissed ? (
                <Link
                  href={`/plan?date=${bar.day.date}`}
                  aria-label={bar.day.label}
                  className="pointer-events-auto flex flex-col items-stretch gap-1 active:opacity-70"
                  data-testid="missed-bar-link"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          )
        })}
      </ul>

      <div aria-hidden className="pointer-events-none relative grid grid-cols-7 justify-items-center gap-2 text-[13px] text-[var(--axis-text)]">
        {bars.map(({ day }) => (
          <span
            key={day.date}
            className={cn(
              // Today: 20 pt, its ring 28 across.
              'box-border flex size-7 items-center justify-center rounded-full',
              day.isToday && 'size-5 state-today my-1 font-semibold text-accent-text',
              !day.isToday && day.state === 'rest' && 'opacity-40',
            )}
          >
            {day.letter}
          </span>
        ))}
      </div>

    </section>
  )
}
