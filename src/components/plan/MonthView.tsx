'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { sessionZone, zoneColor } from '@/lib/colors'
import { type ActivitySummary, type ActivityType, type PlannedWorkout } from '@/domain/activity/types'
import { round } from '@/lib/math'
import { formatDate, formatRanKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { cardClass } from '@/components/ui/Card'
import { Legend, LegendItem } from '@/components/ui/Legend'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { PlanPeriodNav } from './PlanPeriodNav'
import { PlannedWorkoutSheet } from './PlannedWorkoutSheet'
import { plannedWorkoutView, type PlanWorkoutView } from './planWorkoutView'
import { formatWeekKm } from './weekPlanDays'
import { monthDays, type MonthDay, type MonthDayState } from './monthDays'
import { t } from '@/i18n'
import type { PlanPrescriptionView } from './planCoachingView'
import { prescriptionDistanceMeters } from '@/components/coaching/presentation'
import { COACHING_TO_ACTIVITY_TYPE } from '@/domain/coaching/types'

interface Props {
  year: number
  month: number
  byDate: Map<string, ActivitySummary[]>
  byDatePlanned: Map<string, PlannedWorkout>
  byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>
  today: string
  atPresent: boolean
  onToday: () => void
  onSelectDay: (date: string) => void
  onPrev: () => void
  onNext: () => void
  canGoForward: boolean
}

const WEEKDAYS = t.plan.weekdays
const ROW_HEIGHT = 56
// Seven day columns and nothing else: the 30 px week gutter clipped its
// header at the edge; each week's total is a footer line under its row.
// Each day its own rounded tile, a gap between (design review, Oct 2026,
// mock 1c): a flat grid of hairlines read as a spreadsheet.
const GRID = 'grid grid-cols-7 gap-1.5'
const TILE = 'overflow-hidden rounded-[10px]'

/**
 * A day's state, as the week chart draws it (v4.17): what was run is the
 * accent's soft fill, an extra run too with its own label, a session still to
 * come its type's zone at 12%, a missed one the negative status at 12% with a
 * dashed outline and a cross - never colour alone (design review, Oct 2026).
 * Today is an accent outline on top of whichever it is.
 */
const CELL_FILL: Record<MonthDayState, string> = {
  done: 'bg-[var(--accent-soft)]',
  extra: 'bg-[var(--accent-soft)]',
  planned: 'bg-[color-mix(in_srgb,var(--cell-zone)_12%,transparent)]',
  missed: 'bg-[color-mix(in_srgb,var(--neg)_12%,transparent)]',
  rest: 'border border-border',
}

/** A missed day's dashed outline, inside the cell so it never touches its neighbours'. */
const MISSED_OUTLINE: CSSProperties = { outline: '1.5px dashed var(--neg)', outlineOffset: -3 }

const STATE_WORD: Record<MonthDayState, string> = {
  done: t.sessionState.done,
  extra: t.plan.extraRun,
  planned: t.sessionState.planned,
  missed: t.sessionState.missed,
  rest: t.sessionState.rest,
}

interface DayCellData {
  day: number
  date: string
  acts: ActivitySummary[]
  /** A day of the month before or after, filling its week's row. */
  outside: boolean
}

interface PlannedInfo {
  type: ActivityType
  /** Null for a session planned by time alone. */
  km: number | null
  minutes: number | null
  // A coach prescription and a plain Garmin plan open different things on
  // tap (week view vs. the workout sheet) - everything else about them is
  // drawn identically.
  source: 'coach' | 'garmin'
}

function isoDateOf(year: number, month: number, day: number): string {
  const d = new Date(year, month, day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function plannedInfoFor(
  date: string,
  byDatePlanned: Map<string, PlannedWorkout>,
  byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>
): PlannedInfo | null {
  const coach = byDateCoach?.get(date)?.find((v) => v.state !== 'cancelled')
  if (coach) {
    const meters = prescriptionDistanceMeters(coach.prescription)
    if (meters !== null && meters > 0) {
      return { type: COACHING_TO_ACTIVITY_TYPE[coach.prescription.type], km: meters / 1000, minutes: null, source: 'coach' }
    }
  }
  // A Garmin session planned by time alone is still a session: Month read
  // five such July days as rest and never as missed, where Week counted them.
  const plan = byDatePlanned.get(date)
  if (plan && (plan.distanceM || plan.durationSecs)) {
    return {
      type: (plan.type as ActivityType | undefined) ?? 'Base',
      km: plan.distanceM ? plan.distanceM / 1000 : null,
      minutes: plan.durationSecs ? Math.round(plan.durationSecs / 60) : null,
      source: 'garmin',
    }
  }
  return null
}

/** What a session was planned at, bare - its km, or its minutes when it has none - and with its unit. */
function plannedFigure(planned: PlannedInfo): { bare: string; full: string } | null {
  if (planned.km !== null) return { bare: formatWeekKm(planned.km), full: `${formatWeekKm(planned.km)} ${t.units.km}` }
  return planned.minutes !== null ? { bare: `${planned.minutes}′`, full: `${planned.minutes} ${t.units.min}` } : null
}

/** The day's one figure with its unit, for its name: the tile shows it bare. */
function figureWords(planned: PlannedInfo | null, ranKm: number, hasActs: boolean): string | null {
  if (hasActs) return `${formatRanKm(ranKm)} ${t.units.km}`
  return planned ? (plannedFigure(planned)?.full ?? null) : null
}

// One figure a day, bare, as mock 1c draws it (design review, Oct 2026): what
// was run in bold - as the week view writes it, "10", not "10.0" - else what
// is planned, light; a missed one in the negative status, its ✕ up by the
// date where a phone-width tile has room for it, and a run
// nothing was planned for labelled "extra" over its figure. The week row
// under it carries the unit.
function CellValue({ planned, ranKm, hasActs, state }: { planned: PlannedInfo | null; ranKm: number; hasActs: boolean; state: MonthDayState }) {
  const figure = planned && plannedFigure(planned)
  return (
    <div className="mt-auto flex min-w-0 flex-col leading-tight">
      {state === 'extra' && <span className="truncate text-[11px] leading-none text-muted-foreground">{t.plan.extra}</span>}
      {hasActs ? (
        <span className="truncate text-[13px] font-semibold tabular-nums text-foreground">{formatRanKm(ranKm)}</span>
      ) : (
        figure && (
          <span className={cn('truncate text-[13px] tabular-nums', state === 'missed' ? 'font-semibold text-[var(--neg)]' : 'text-[var(--text-2)]')}>
            {figure.bare}
          </span>
        )
      )}
    </div>
  )
}

const CELL_BUTTON = 'flex h-full w-full flex-col items-start px-2 pb-1.5 pt-1.5 text-left transition-colors hover:bg-[var(--surface-2)]'

// Same tap targets this pass found already correct, just carrying the new
// single-value content: a completed day, or a coach-planned one, opens the
// week view at that date; a plain Garmin-only plan opens its own sheet.
// A day with neither is a plain div - nothing to open.
function DayCell({
  cell,
  isToday,
  planned,
  day,
  garminPlan,
  onSelectDay,
  onOpenSheet,
}: {
  cell: DayCellData
  isToday: boolean
  planned: PlannedInfo | null
  day: MonthDay
  garminPlan: PlannedWorkout | null
  onSelectDay: (date: string) => void
  onOpenSheet: (workout: PlannedWorkout, missed: boolean) => void
}) {
  const ranKm = cell.acts.reduce((sum, a) => sum + a.distanceKm, 0)
  const hasActs = cell.acts.length > 0
  const dayNumber = (
    <span className="flex w-full items-start justify-between">
      <span
        className="text-xs leading-none"
        style={{ color: isToday ? 'var(--accent-text)' : 'var(--muted-foreground)', fontWeight: isToday ? 600 : 400 }}
      >
        {cell.day}
      </span>
      {day.state === 'missed' && <span aria-hidden className="text-[11px] font-semibold leading-none text-[var(--neg)]">✕</span>}
      {/* The session's type in its full zone colour, the legend's own square:
          the 12% tints alone were about 1.2:1 on the card and looked alike
          (screen audit, Oct 2026). */}
      {day.state === 'planned' && planned && (
        <span
          aria-hidden
          data-testid="month-zone-mark"
          className="mt-px h-2 w-2 shrink-0 rounded-[2px]"
          style={{ background: zoneColor(sessionZone(planned)) }}
        />
      )}
    </span>
  )
  const value = (planned || hasActs) && <CellValue planned={planned} ranKm={ranKm} hasActs={hasActs} state={day.state} />
  // The state and the figure, with its unit, in the name, as the week chart
  // names its days: colour, shape and a bare number are not all a screen
  // reader should hear.
  const words = figureWords(planned, ranKm, hasActs)
  const name = [formatDate(cell.date, { style: 'full' }), STATE_WORD[day.state], words].filter(Boolean).join(' · ')

  if (hasActs || planned?.source === 'coach') {
    return (
      <button type="button" onClick={() => onSelectDay(cell.date)} aria-label={name} className={CELL_BUTTON}>
        {dayNumber}
        {value}
      </button>
    )
  }

  if (planned?.source === 'garmin' && garminPlan) {
    return (
      <button type="button" onClick={() => onOpenSheet(garminPlan, day.state === 'missed')} aria-label={name} className={CELL_BUTTON}>
        {dayNumber}
        {value}
      </button>
    )
  }

  return <div className="flex h-full w-full flex-col items-start px-2 pt-1.5">{dayNumber}</div>
}

export function MonthView({
  year,
  month,
  byDate,
  byDatePlanned,
  byDateCoach,
  today,
  atPresent,
  onToday,
  onSelectDay,
  onPrev,
  onNext,
  canGoForward,
}: Props) {
  const [sheetWorkout, setSheetWorkout] = useState<PlanWorkoutView | null>(null)

  const monthLabel = formatDate(isoDateOf(year, month, 1), { precision: 'month', style: 'full', year: 'always' })

  const { rows, sessionCount, ranKm, plannedKm, days, zones } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() || 7) - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    // Only the weeks the month needs: an empty sixth row cost 120 pt.
    const cellCount = Math.ceil((startOffset + daysInMonth) / 7) * 7

    // Each row a whole Monday-to-Sunday week, its days from the months either
    // side included (the owner's report, Oct 2026): October's first row read
    // 33 of 31 km for a week run at 53, the Tuesday and Wednesday of
    // September left out. The month's own figures stay the month's.
    const cells: DayCellData[] = []
    let sessionCount = 0
    let ranKm = 0
    let plannedKm = 0
    const zones = new Set<ReturnType<typeof sessionZone>>()

    for (let i = 0; i < cellCount; i++) {
      const at = new Date(year, month, 1 - startOffset + i)
      const date = isoDateOf(at.getFullYear(), at.getMonth(), at.getDate())
      const outside = at.getMonth() !== month
      const acts = byDate.get(date) ?? []
      const planned = plannedInfoFor(date, byDatePlanned, byDateCoach)
      // The key names the colours drawn, a muted day's too.
      if (planned) zones.add(sessionZone(planned))
      if (!outside) {
        sessionCount += acts.length
        ranKm += acts.reduce((s, a) => s + a.distanceKm, 0)
        plannedKm += planned?.km ?? 0
      }
      cells.push({ day: at.getDate(), date, acts, outside })
    }

    const rows: DayCellData[][] = []
    for (let i = 0; i < cells.length / 7; i++) rows.push(cells.slice(i * 7, i * 7 + 7))

    const days = monthDays(cells.map((c) => c.date), (d) => (byDate.get(d)?.length ?? 0) > 0, (d) => plannedInfoFor(d, byDatePlanned, byDateCoach) !== null, today)
    return { rows, sessionCount, ranKm: round(ranKm, 0), plannedKm: round(plannedKm, 0), days, zones: [...zones].sort() }
  }, [year, month, byDate, byDatePlanned, byDateCoach, today])

  return (
    <section className={cardClass({ padding: 'none', overflow: true })}>
      <div className="px-5 pb-3.5 pt-4">
        <PlanPeriodNav
          label={monthLabel}
          onPrev={onPrev}
          onNext={onNext}
          nextDisabled={atPresent && !canGoForward}
          // Hidden while today's month is on screen.
          onToday={atPresent ? null : onToday}
        />
      </div>

      <div className={cn(GRID, 'px-3')}>
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cn(EYEBROW_CLASS, 'pb-2 text-center', i >= 5 ? 'text-subtle' : 'text-muted-foreground')}>
            {d}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 px-3">
        {rows.map((row, rowIndex) => {
          const containsToday = row.some((c) => c.date === today)
          const rowIsFuture = row.every((c) => c.date > today)
          const weekRan = row.reduce((s, c) => s + c.acts.reduce((sa, a) => sa + a.distanceKm, 0), 0)
          const weekPlanned = row.reduce((s, c) => s + (plannedInfoFor(c.date, byDatePlanned, byDateCoach)?.km ?? 0), 0)
          const weekHasPlan = row.some((c) => plannedInfoFor(c.date, byDatePlanned, byDateCoach) !== null)
          // One format for every week (H21), in the week view's rounding
          // (design review, Oct 2026): "20.5 / 53 km" run against plan, "24 km
          // · no plan" a week the plan said nothing about, and a week still to
          // come with nothing planned "No plan yet".
          const footer =
            weekPlanned > 0 ? t.plan.weekSummary.ranOfPlan(formatRanKm(weekRan), formatWeekKm(weekPlanned))
            : weekHasPlan ? `${formatRanKm(weekRan)} ${t.units.km}`
            : rowIsFuture ? t.plan.noPlanYet
            : t.plan.weekNoPlan(formatRanKm(weekRan))
          const share = weekPlanned > 0 ? Math.min(1, weekRan / weekPlanned) : null

          return (
            <div key={rowIndex}>
              <div className={GRID} style={{ height: `${ROW_HEIGHT}px` }}>
                {row.map((cell, i) => {
                  const planned = plannedInfoFor(cell.date, byDatePlanned, byDateCoach)
                  const day = days.get(cell.date) ?? { state: 'rest' as const }
                  const state = day.state
                  const isToday = cell.date === today
                  return (
                    <div
                      key={i}
                      data-cell-state={state}
                      data-outside-month={cell.outside || undefined}
                      // The month either side's days at half strength: there, and as tappable, but not this month's.
                      className={cn(TILE, CELL_FILL[state], cell.outside && 'opacity-50')}
                      style={{
                        ...(state === 'planned' && planned ? ({ '--cell-zone': zoneColor(sessionZone(planned)) } as CSSProperties) : {}),
                        ...(state === 'missed' ? MISSED_OUTLINE : {}),
                        ...(isToday ? { boxShadow: 'inset 0 0 0 2px var(--accent)' } : {}),
                      }}
                    >
                      <DayCell
                        cell={cell}
                        isToday={isToday}
                        planned={planned}
                        day={day}
                        garminPlan={byDatePlanned.get(cell.date) ?? null}
                        onSelectDay={onSelectDay}
                        onOpenSheet={(workout, missed) => {
                          const view = plannedWorkoutView(workout)
                          // Read-only: what was planned and that nothing matched it, no reschedule.
                          setSheetWorkout(missed ? { ...view, statusLabel: t.plan.missedNoRun } : view)
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <p
                data-testid="month-week-total"
                className={cn('flex items-center justify-end gap-2 pb-1.5 pt-1 text-[13px] font-medium tabular-nums', containsToday ? 'text-foreground' : 'text-[var(--text-2)]')}
              >
                {share !== null && (
                  // Run against plan, capped at the plan: a week over it is full, not longer.
                  <span aria-hidden className="relative h-1 w-14 overflow-hidden rounded-full bg-[var(--line-2)]">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
                  </span>
                )}
                <span className="whitespace-nowrap">{footer}</span>
              </p>
            </div>
          )
        })}
      </div>

      {/* One line of legend (design review, Oct 2026): done, the session
          types the grid plans, missed. Today's outline, the "extra" label
          and bold-ran / light-planned say themselves. */}
      {/* Swatches in the full colours, as mock 1c keys them: the tiles' own
          tints were too dark to read as a key. */}
      <div className="mx-3 mt-1.5 border-t border-border px-1 pt-3" data-testid="month-legend">
        <Legend>
          <LegendItem swatch="square" color="var(--accent)">{t.sessionState.done}</LegendItem>
          {zones.map((zone) => (
            <LegendItem key={zone} swatch="square" color={zoneColor(zone)}>
              {t.zoneLabels[zone]}
            </LegendItem>
          ))}
          <span className="flex items-center gap-1.5 text-[var(--neg)]">
            <span aria-hidden className="text-[11px] font-semibold leading-none">✕</span>
            <span className="text-muted-foreground">{t.sessionState.missed}</span>
          </span>
        </Legend>
      </div>
      <p className="px-4 pb-4 pt-2.5 text-[13px] text-muted-foreground">{t.plan.summary(sessionCount, ranKm, plannedKm)}</p>

      {sheetWorkout && <PlannedWorkoutSheet workout={sheetWorkout} onClose={() => setSheetWorkout(null)} />}
    </section>
  )
}
