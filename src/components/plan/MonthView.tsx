'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { sessionZone, zoneColor } from '@/lib/colors'
import { type ActivitySummary, type ActivityType, type PlannedWorkout } from '@/domain/activity/types'
import { round } from '@/lib/math'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'
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
const PAD_BG = 'color-mix(in srgb, var(--foreground) 2%, transparent)'
const RULE_BORDER = 'var(--border)'
const PLANNED_INK = 'var(--subtle)'
const RAN_INK = 'var(--foreground)'
// "Today" and selection follow the accent. The today cell used to be ringed in
// a fixed emerald, the colour Base, Form and "productive" also wear - with the
// Nature accent the two became the same green with two meanings.
const TODAY_INK = 'text-accent-text'
// Seven day columns and nothing else: the 30 px week gutter clipped its
// header at the edge; each week's total is a footer line under its row.
const GRID_COLUMNS = 'repeat(7,1fr)'

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

// A run with no plan behind it simply has no bar - the legend says so - where
// an "extra" sub-label about 9 pt tall used to.
function CellValue({ planned, ranKm, hasActs }: { planned: PlannedInfo | null; ranKm: number; hasActs: boolean }) {
  return (
    <div className="mt-1 flex items-stretch" style={{ gap: '4px' }}>
      {planned && (
        <span
          className="shrink-0 rounded-full"
          style={{ width: '3px', background: zoneColor(sessionZone(planned)) }}
        />
      )}
      <div className="flex min-w-0 flex-col justify-center" style={{ lineHeight: 1.15 }}>
        {planned && (
          <span className="text-caption tabular-nums" style={{ color: PLANNED_INK }}>
            {Math.round(planned.km)}
          </span>
        )}
        {hasActs && (
          <span className="text-caption font-bold tabular-nums" style={{ color: RAN_INK }}>
            {ranKm.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )
}

// Same tap targets this pass found already correct, just carrying the new
// single-value content: a completed day, or a coach-planned one, opens the
// week view at that date; a plain Garmin-only plan opens its own sheet.
// A day with neither is a plain div - nothing to open.
function DayCell({
  cell,
  isToday,
  planned,
  garminPlan,
  onSelectDay,
  onOpenSheet,
}: {
  cell: DayCellData
  isToday: boolean
  planned: PlannedInfo | null
  garminPlan: PlannedWorkout | null
  onSelectDay: (date: string) => void
  onOpenSheet: (workout: PlannedWorkout) => void
}) {
  const ranKm = cell.acts.reduce((sum, a) => sum + a.distanceKm, 0)
  const hasActs = cell.acts.length > 0
  const dayNumber = (
    <p
      className="text-xs leading-none"
      style={{ color: isToday ? 'var(--accent-text)' : 'var(--muted-foreground)', fontWeight: isToday ? 700 : 400 }}
    >
      {cell.day}
    </p>
  )

  if (hasActs || planned?.source === 'coach') {
    return (
      <button
        type="button"
        onClick={() => onSelectDay(cell.date)}
        aria-label={formatDate(cell.date, { style: 'full' })}
        className="flex h-full w-full flex-col items-start px-1 pt-1 text-left transition-colors hover:bg-foreground/[0.06]"
      >
        {dayNumber}
        {(planned || hasActs) && <CellValue planned={planned} ranKm={ranKm} hasActs={hasActs} />}
      </button>
    )
  }

  if (planned?.source === 'garmin' && garminPlan) {
    return (
      <button
        type="button"
        onClick={() => onOpenSheet(garminPlan)}
        aria-label={formatDate(cell.date, { style: 'full' })}
        className="flex h-full w-full flex-col items-start px-1 pt-1 text-left transition-colors hover:bg-foreground/[0.06]"
      >
        {dayNumber}
        <CellValue planned={planned} ranKm={ranKm} hasActs={hasActs} />
      </button>
    )
  }

  return (
    <div className="flex h-full w-full flex-col items-start px-1 pt-1">
      {dayNumber}
    </div>
  )
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            aria-label={t.plan.prevPeriod}
            className="hit-44 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] transition-colors hover:bg-foreground/[0.06]"
            style={{ border: `1px solid ${RULE_BORDER}` }}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center" style={{ width: '170px' }}>
            <span className="font-display font-bold" style={{ fontSize: '19px' }}>{monthLabel}</span>
          </div>
          <button
            type="button"
            onClick={onNext}
            disabled={atPresent && !canGoForward}
            aria-label={t.plan.nextPeriod}
            className="hit-44 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] transition-colors hover:bg-foreground/[0.06] disabled:opacity-40"
            style={{ border: `1px solid ${RULE_BORDER}` }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={onToday}
          disabled={atPresent}
          className={cn('hit-44 shrink-0 rounded-full font-semibold disabled:opacity-40', TODAY_INK)}
          style={{ fontSize: '12.5px', border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)', padding: '5px 12px' }}
        >
          {t.plan.today}
        </button>
      </div>

      <p className="px-1 text-footnote text-muted-foreground">{t.plan.summary(sessionCount, ranKm, plannedKm)}</p>

      <GlassSurface variant="card" className="overflow-hidden rounded-card-sm">
        <div className="grid border-b border-foreground/[0.08]" style={{ gridTemplateColumns: GRID_COLUMNS, gap: '2px' }}>
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className="py-2 text-center font-mono font-semibold uppercase"
              style={{ fontSize: '11px', color: i >= 5 ? 'var(--subtle-2)' : 'var(--subtle)' }}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="flex flex-col" style={{ gap: '2px' }}>
          {rows.map((row, rowIndex) => {
            const realCells = row.filter((c): c is DayCellData => c !== null)
            const containsToday = realCells.some((c) => c.date === today)
            const rowIsPast = realCells.length > 0 && realCells.every((c) => c.date < today)
            const weekValue =
              realCells.length === 0
                ? null
                : rowIsPast
                  ? round(realCells.reduce((s, c) => s + c.acts.reduce((sa, a) => sa + a.distanceKm, 0), 0), 0)
                  : round(
                      realCells.reduce((s, c) => s + (plannedInfoFor(c.date, byDatePlanned, byDateCoach)?.km ?? 0), 0),
                      0
                    )

            return (
              <div key={rowIndex}>
              <div
                className="grid"
                style={{ gridTemplateColumns: GRID_COLUMNS, gap: '2px', height: `${ROW_HEIGHT}px` }}
              >
                {row.map((cell, i) => (
                  <div
                    key={i}
                    className="overflow-hidden border-b border-r border-foreground/[0.06] [&:nth-child(7n)]:border-r-0"
                    style={
                      !cell
                        ? { background: PAD_BG }
                        : cell.date === today
                          ? { background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1.5px solid var(--accent)' }
                          : undefined
                    }
                  >
                    {cell && (
                      <DayCell
                        cell={cell}
                        isToday={cell.date === today}
                        planned={plannedInfoFor(cell.date, byDatePlanned, byDateCoach)}
                        garminPlan={byDatePlanned.get(cell.date) ?? null}
                        onSelectDay={onSelectDay}
                        onOpenSheet={(workout) => setSheetWorkout(plannedWorkoutView(workout))}
                      />
                    )}
                  </div>
                ))}
              </div>
              {weekValue !== null && (
                <p
                  className="px-1.5 py-0.5 text-right text-caption tabular-nums"
                  style={{ color: containsToday ? 'var(--muted-foreground)' : 'var(--subtle)' }}
                >
                  {rowIsPast ? t.plan.weekFooter.ran(weekValue) : t.plan.weekFooter.planned(weekValue)}
                </p>
              )}
              </div>
            )
          })}
        </div>
      </GlassSurface>


      {sheetWorkout && <PlannedWorkoutSheet workout={sheetWorkout} onClose={() => setSheetWorkout(null)} />}
    </div>
  )
}
