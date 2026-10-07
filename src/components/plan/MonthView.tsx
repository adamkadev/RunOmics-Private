'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { sessionZone, zoneColor } from '@/lib/colors'
import { type ActivitySummary, type ActivityType, type PlannedWorkout } from '@/domain/activity/types'
import { round } from '@/lib/math'
import { formatDate, formatKm, formatRanKm } from '@/lib/formatters'
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
const ROW_HEIGHT = 58
// Seven day columns and nothing else: the 30 px week gutter clipped its
// header at the edge; each week's total is a footer line under its row.
const GRID_COLUMNS = 'repeat(7,minmax(0,1fr))'

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
  rest: '',
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

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
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

/** What a session was planned at: its distance, or its time when it has none. */
function plannedFigure(planned: PlannedInfo): string | null {
  if (planned.km !== null) return `${formatWeekKm(planned.km)} ${t.units.km}`
  return planned.minutes !== null ? `${planned.minutes} ${t.units.min}` : null
}

// A day's planned km over what it ran - "10 km" light a plan, "8.5 km" bold a
// run - a missed one "✕ 10 km" in the negative status, and a run nothing was
// planned for labelled "extra" over its figure.
function CellValue({ planned, ranKm, hasActs, state }: { planned: PlannedInfo | null; ranKm: number; hasActs: boolean; state: MonthDayState }) {
  const figure = planned && plannedFigure(planned)
  return (
    <div className="mt-auto flex min-w-0 flex-col" style={{ lineHeight: 1.2 }}>
      {state === 'extra' && <span className="truncate text-[11px] leading-none text-muted-foreground">{t.plan.extra}</span>}
      {figure && (
        <span className={cn('truncate text-caption', state === 'missed' ? 'font-medium text-[var(--neg)]' : 'text-[var(--text-2)]')}>
          {state === 'missed' && <span aria-hidden>✕ </span>}
          {figure}
        </span>
      )}
      {hasActs && (
        <span className="truncate text-caption font-semibold text-foreground">
          {formatKm(ranKm, 1)} {t.units.km}
        </span>
      )}
    </div>
  )
}

const CELL_BUTTON = 'flex h-full w-full flex-col items-start px-1.5 pb-1 pt-1.5 text-left transition-colors hover:bg-[var(--surface-2)]'

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
    <p
      className="text-xs leading-none"
      style={{ color: isToday ? 'var(--accent-text)' : 'var(--muted-foreground)', fontWeight: isToday ? 600 : 400 }}
    >
      {cell.day}
    </p>
  )
  const value = (planned || hasActs) && <CellValue planned={planned} ranKm={ranKm} hasActs={hasActs} state={day.state} />
  // The state in the name too, as the week chart names its days: colour and
  // shape are not all a screen reader hears.
  const name = `${formatDate(cell.date, { style: 'full' })} · ${STATE_WORD[day.state]}`

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

  return <div className="flex h-full w-full flex-col items-start px-1.5 pt-1.5">{dayNumber}</div>
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
    const prefix = monthKey(year, month)

    const cells: (DayCellData | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    let sessionCount = 0
    let ranKm = 0
    let plannedKm = 0
    const zones = new Set<ReturnType<typeof sessionZone>>()

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${prefix}-${String(day).padStart(2, '0')}`
      const acts = byDate.get(date) ?? []
      sessionCount += acts.length
      ranKm += acts.reduce((s, a) => s + a.distanceKm, 0)
      const planned = plannedInfoFor(date, byDatePlanned, byDateCoach)
      if (planned) {
        plannedKm += planned.km ?? 0
        zones.add(sessionZone(planned))
      }
      cells.push({ day, date, acts })
    }
    // Only the weeks the month needs: an empty sixth row cost 120 pt.
    while (cells.length % 7 !== 0) cells.push(null)

    const rows: (DayCellData | null)[][] = []
    for (let i = 0; i < cells.length / 7; i++) rows.push(cells.slice(i * 7, i * 7 + 7))

    const dates = cells.filter((c): c is DayCellData => c !== null).map((c) => c.date)
    const days = monthDays(dates, (d) => (byDate.get(d)?.length ?? 0) > 0, (d) => plannedInfoFor(d, byDatePlanned, byDateCoach) !== null, today)
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

      <div className="grid border-y border-border" style={{ gridTemplateColumns: GRID_COLUMNS }}>
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cn(EYEBROW_CLASS, 'py-2 text-center', i >= 5 ? 'text-subtle' : 'text-muted-foreground')}>
            {d}
          </div>
        ))}
      </div>

      <div className="flex flex-col">
        {rows.map((row, rowIndex) => {
          const realCells = row.filter((c): c is DayCellData => c !== null)
          const containsToday = realCells.some((c) => c.date === today)
          const rowIsFuture = realCells.length > 0 && realCells.every((c) => c.date > today)
          const weekRan = realCells.reduce((s, c) => s + c.acts.reduce((sa, a) => sa + a.distanceKm, 0), 0)
          const weekPlanned = realCells.reduce((s, c) => s + (plannedInfoFor(c.date, byDatePlanned, byDateCoach)?.km ?? 0), 0)
          const weekHasPlan = realCells.some((c) => plannedInfoFor(c.date, byDatePlanned, byDateCoach) !== null)
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
            <div key={rowIndex} className="border-t border-border first:border-t-0">
              <div className="grid" style={{ gridTemplateColumns: GRID_COLUMNS, height: `${ROW_HEIGHT}px` }}>
                {row.map((cell, i) => {
                  if (!cell) return <div key={i} className="border-r border-border bg-[var(--surface-2)] [&:nth-child(7n)]:border-r-0" />
                  const planned = plannedInfoFor(cell.date, byDatePlanned, byDateCoach)
                  const day = days.get(cell.date) ?? { state: 'rest' as const }
                  const state = day.state
                  const isToday = cell.date === today
                  return (
                    <div
                      key={i}
                      data-cell-state={state}
                      className={cn('overflow-hidden border-r border-border [&:nth-child(7n)]:border-r-0', CELL_FILL[state])}
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
              {realCells.length > 0 && (
                <p
                  data-testid="month-week-total"
                  className={cn('flex items-center justify-end gap-2 px-2 py-1 text-caption', containsToday ? 'text-[var(--text-2)]' : 'text-muted-foreground')}
                >
                  {share !== null && (
                    // Run against plan, capped at the plan: a week over it is full, not longer.
                    <span aria-hidden className="relative h-1 w-14 overflow-hidden rounded-full bg-[var(--line-2)]">
                      <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
                    </span>
                  )}
                  <span className="whitespace-nowrap">{footer}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* One line of legend (design review, Oct 2026): done, the session
          types this month plans, missed. Today's outline, the "extra" label
          and bold-ran / light-planned say themselves. */}
      <div className="border-t border-border px-5 pt-3" data-testid="month-legend">
        <Legend>
          <LegendItem swatch="square" color="var(--accent-soft)">{t.sessionState.done}</LegendItem>
          {zones.map((zone) => (
            <LegendItem key={zone} swatch="square" color={`color-mix(in srgb, ${zoneColor(zone)} 35%, transparent)`}>
              {t.zoneLabels[zone]}
            </LegendItem>
          ))}
          <span className="flex items-center gap-1.5 text-[var(--neg)]">
            <span aria-hidden className="text-[11px] font-semibold leading-none">✕</span>
            <span className="text-muted-foreground">{t.sessionState.missed}</span>
          </span>
        </Legend>
      </div>
      <p className="px-5 pb-3.5 pt-2.5 text-[13px] text-muted-foreground">{t.plan.summary(sessionCount, ranKm, plannedKm)}</p>

      {sheetWorkout && <PlannedWorkoutSheet workout={sheetWorkout} onClose={() => setSheetWorkout(null)} />}
    </section>
  )
}
