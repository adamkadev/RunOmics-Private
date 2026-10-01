'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { sessionZone, zoneColor } from '@/lib/colors'
import { type ActivitySummary, type ActivityType, type PlannedWorkout } from '@/domain/activity/types'
import { round } from '@/lib/math'
import { formatDate, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { PlanPeriodNav } from './PlanPeriodNav'
import { PlannedWorkoutSheet } from './PlannedWorkoutSheet'
import { plannedWorkoutView, type PlanWorkoutView } from './planWorkoutView'
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
 * accent's soft fill, a session still to come its type's zone at 12%, a
 * missed one the negative status at 12%. Today is an accent outline on top
 * of whichever it is.
 */
type CellState = 'done' | 'planned' | 'missed' | 'rest'

const CELL_FILL: Record<CellState, string> = {
  done: 'bg-[var(--accent-soft)]',
  planned: 'bg-[color-mix(in_srgb,var(--cell-zone)_12%,transparent)]',
  missed: 'bg-[color-mix(in_srgb,var(--neg)_12%,transparent)]',
  rest: '',
}

interface DayCellData {
  day: number
  date: string
  acts: ActivitySummary[]
}

interface PlannedInfo {
  type: ActivityType
  km: number
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
      return { type: COACHING_TO_ACTIVITY_TYPE[coach.prescription.type], km: meters / 1000, source: 'coach' }
    }
  }
  const plan = byDatePlanned.get(date)
  if (plan?.distanceM) {
    return { type: (plan.type as ActivityType | undefined) ?? 'Base', km: plan.distanceM / 1000, source: 'garmin' }
  }
  return null
}

// A day's planned km over what it ran - "10 km" a plan, "8.5 km" bold a run.
// A run with no plan behind it has only its own figure.
function CellValue({ planned, ranKm, hasActs, missed }: { planned: PlannedInfo | null; ranKm: number; hasActs: boolean; missed: boolean }) {
  return (
    <div className="mt-auto flex min-w-0 flex-col" style={{ lineHeight: 1.2 }}>
      {planned && (
        <span className={cn('truncate text-caption', missed ? 'font-medium text-[var(--neg)]' : 'text-[var(--text-2)]')}>
          {Math.round(planned.km)} {t.units.km}
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
  missed,
  garminPlan,
  onSelectDay,
  onOpenSheet,
}: {
  cell: DayCellData
  isToday: boolean
  planned: PlannedInfo | null
  missed: boolean
  garminPlan: PlannedWorkout | null
  onSelectDay: (date: string) => void
  onOpenSheet: (workout: PlannedWorkout) => void
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
  const value = (planned || hasActs) && <CellValue planned={planned} ranKm={ranKm} hasActs={hasActs} missed={missed} />

  if (hasActs || planned?.source === 'coach') {
    return (
      <button type="button" onClick={() => onSelectDay(cell.date)} aria-label={formatDate(cell.date, { style: 'full' })} className={CELL_BUTTON}>
        {dayNumber}
        {value}
      </button>
    )
  }

  if (planned?.source === 'garmin' && garminPlan) {
    return (
      <button type="button" onClick={() => onOpenSheet(garminPlan)} aria-label={formatDate(cell.date, { style: 'full' })} className={CELL_BUTTON}>
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

  const { rows, sessionCount, ranKm, plannedKm } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() || 7) - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prefix = monthKey(year, month)

    const cells: (DayCellData | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    let sessionCount = 0
    let ranKm = 0
    let plannedKm = 0

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${prefix}-${String(day).padStart(2, '0')}`
      const acts = byDate.get(date) ?? []
      sessionCount += acts.length
      ranKm += acts.reduce((s, a) => s + a.distanceKm, 0)
      const planned = plannedInfoFor(date, byDatePlanned, byDateCoach)
      if (planned) plannedKm += planned.km
      cells.push({ day, date, acts })
    }
    // Only the weeks the month needs: an empty sixth row cost 120 pt.
    while (cells.length % 7 !== 0) cells.push(null)

    const rows: (DayCellData | null)[][] = []
    for (let i = 0; i < cells.length / 7; i++) rows.push(cells.slice(i * 7, i * 7 + 7))

    return { rows, sessionCount, ranKm: round(ranKm, 0), plannedKm: round(plannedKm, 0) }
  }, [year, month, byDate, byDatePlanned, byDateCoach])

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
          const rowIsPast = realCells.length > 0 && realCells.every((c) => c.date < today)
          const weekRan = round(realCells.reduce((s, c) => s + c.acts.reduce((sa, a) => sa + a.distanceKm, 0), 0), 0)
          const weekPlanned = round(
            realCells.reduce((s, c) => s + (plannedInfoFor(c.date, byDatePlanned, byDateCoach)?.km ?? 0), 0),
            0
          )
          const weekValue = realCells.length === 0 ? null : rowIsPast ? weekRan : weekPlanned
          // One format for every week, "27 / 48 km" (H21): past, current
          // and future weeks read "14 km run", "27 of 48 km", "20 km planned".
          const footer = t.plan.weekFooter(weekRan, weekPlanned)

          return (
            <div key={rowIndex} className="border-t border-border first:border-t-0">
              <div className="grid" style={{ gridTemplateColumns: GRID_COLUMNS, height: `${ROW_HEIGHT}px` }}>
                {row.map((cell, i) => {
                  if (!cell) return <div key={i} className="border-r border-border bg-[var(--surface-2)] [&:nth-child(7n)]:border-r-0" />
                  const planned = plannedInfoFor(cell.date, byDatePlanned, byDateCoach)
                  const hasActs = cell.acts.length > 0
                  const state: CellState = hasActs ? 'done' : planned ? (cell.date < today ? 'missed' : 'planned') : 'rest'
                  const isToday = cell.date === today
                  return (
                    <div
                      key={i}
                      data-cell-state={state}
                      className={cn('overflow-hidden border-r border-border [&:nth-child(7n)]:border-r-0', CELL_FILL[state])}
                      style={{
                        ...(state === 'planned' && planned ? ({ '--cell-zone': zoneColor(sessionZone(planned)) } as CSSProperties) : {}),
                        ...(isToday ? { boxShadow: 'inset 0 0 0 2px var(--accent)' } : {}),
                      }}
                    >
                      <DayCell
                        cell={cell}
                        isToday={isToday}
                        planned={planned}
                        missed={state === 'missed'}
                        garminPlan={byDatePlanned.get(cell.date) ?? null}
                        onSelectDay={onSelectDay}
                        onOpenSheet={(workout) => setSheetWorkout(plannedWorkoutView(workout))}
                      />
                    </div>
                  )
                })}
              </div>
              {weekValue !== null && (
                <p
                  className={cn('px-2 py-1 text-right text-caption', containsToday ? 'text-[var(--text-2)]' : 'text-muted-foreground')}
                >
                  {footer}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className="border-t border-border px-5 py-3.5 text-[13px] text-muted-foreground">{t.plan.summary(sessionCount, ranKm, plannedKm)}</p>

      {sheetWorkout && <PlannedWorkoutSheet workout={sheetWorkout} onClose={() => setSheetWorkout(null)} />}
    </section>
  )
}
