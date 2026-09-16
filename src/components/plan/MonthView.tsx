'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import type { ActivitySummary, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { round } from '@/lib/math'
import { formatDate } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { PlannedWorkoutSheet } from './PlannedWorkoutSheet'
import { plannedWorkoutView, type PlanWorkoutView } from './planWorkoutView'
import { t } from '@/i18n'
import type { PrescriptionView } from '@/application/coaching/GetCoachingView'
import { prescriptionDistanceMeters } from '@/components/coaching/presentation'
import { COACHING_TO_ACTIVITY_TYPE } from '@/domain/coaching/types'

interface Props {
  year: number
  month: number
  byDate: Map<string, ActivitySummary[]>
  byDatePlanned: Map<string, PlannedWorkout>
  byDateCoach?: ReadonlyMap<string, PrescriptionView[]>
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
const PAD_BG = 'rgba(148,178,220,.02)'
const RULE_BORDER = 'rgba(148,178,220,.18)'
const PLANNED_INK = 'var(--subtle)'
const RAN_INK = 'var(--foreground)'
const EXTRA_INK = 'var(--subtle-2)'
const GRID_COLUMNS = 'repeat(7,1fr) 30px'

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
  byDateCoach?: ReadonlyMap<string, PrescriptionView[]>
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

function CellValue({ planned, ranKm, hasActs }: { planned: PlannedInfo | null; ranKm: number; hasActs: boolean }) {
  const isExtra = hasActs && !planned
  return (
    <div className="mt-1 flex items-stretch" style={{ gap: '4px' }}>
      {planned && (
        <span
          className="shrink-0 rounded-full"
          style={{ width: '3px', background: ACTIVITY_TYPE_CONFIG[planned.type].chartColor }}
        />
      )}
      <div className="flex min-w-0 flex-col justify-center" style={{ lineHeight: 1.15 }}>
        {planned && (
          <span className="tabular-nums" style={{ fontSize: '9.5px', color: PLANNED_INK }}>
            {Math.round(planned.km)}
          </span>
        )}
        {hasActs && (
          <span className="tabular-nums" style={{ fontSize: '10px', fontWeight: 700, color: RAN_INK }}>
            {ranKm.toFixed(1)}
          </span>
        )}
        {isExtra && <span style={{ fontSize: '8.5px', color: EXTRA_INK }}>{t.plan.extra}</span>}
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
      style={{ color: isToday ? 'var(--delta-good)' : 'var(--muted-foreground)', fontWeight: isToday ? 700 : 400 }}
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

  const { rows, legendTypes, sessionCount, ranKm, plannedKm } = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() || 7) - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prefix = monthKey(year, month)

    const cells: (DayCellData | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    let sessionCount = 0
    let ranKm = 0
    let plannedKm = 0
    const plannedTypes = new Set<ActivityType>()

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${prefix}-${String(day).padStart(2, '0')}`
      const acts = byDate.get(date) ?? []
      sessionCount += acts.length
      ranKm += acts.reduce((s, a) => s + a.distanceKm, 0)
      const planned = plannedInfoFor(date, byDatePlanned, byDateCoach)
      if (planned) {
        plannedKm += planned.km
        plannedTypes.add(planned.type)
      }
      cells.push({ day, date, acts })
    }
    while (cells.length < 42) cells.push(null)

    const rows: (DayCellData | null)[][] = []
    for (let i = 0; i < 6; i++) rows.push(cells.slice(i * 7, i * 7 + 7))

    const registryOrder = Object.keys(ACTIVITY_TYPE_CONFIG)
    const legendTypes = [...plannedTypes].sort((a, b) => registryOrder.indexOf(a) - registryOrder.indexOf(b))

    return { rows, legendTypes, sessionCount, ranKm: round(ranKm, 0), plannedKm: round(plannedKm, 0) }
  }, [year, month, byDate, byDatePlanned, byDateCoach])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            aria-label={t.plan.prevPeriod}
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] transition-colors hover:bg-foreground/[0.06]"
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
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] transition-colors hover:bg-foreground/[0.06] disabled:opacity-40"
            style={{ border: `1px solid ${RULE_BORDER}` }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={onToday}
          disabled={atPresent}
          className="shrink-0 rounded-full font-semibold disabled:opacity-40"
          style={{ fontSize: '12.5px', color: '#9cc4ff', border: '1px solid rgba(106,164,255,.35)', padding: '5px 12px' }}
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
              style={{ fontSize: '10px', color: i >= 5 ? 'var(--subtle-2)' : 'var(--subtle)' }}
            >
              {d}
            </div>
          ))}
          <div
            className="py-2 text-right font-mono font-semibold uppercase"
            style={{ fontSize: '9px', color: 'var(--subtle-2)', paddingRight: '4px' }}
          >
            {t.plan.weekGutter}
          </div>
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
              <div
                key={rowIndex}
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
                          ? { background: 'rgba(52,211,153,.07)', border: '1.5px solid #34d399' }
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
                <div className="flex items-center justify-end pr-1" style={{ background: PAD_BG }}>
                  <span
                    className="font-mono tabular-nums"
                    style={{ fontSize: '11px', fontWeight: 700, color: containsToday ? '#c3ccd6' : 'var(--subtle)' }}
                  >
                    {weekValue === null ? t.plan.weekGutterEmpty : weekValue}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </GlassSurface>

      <GlassSurface variant="card" className="space-y-2 rounded-card-sm px-3.5 py-3">
        {legendTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-foreground/[0.08] pb-2 text-xs text-subtle">
            {legendTypes.map((type) => (
              <span key={type} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: ACTIVITY_TYPE_CONFIG[type].chartColor }} />
                {t.activityTypes[type]}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-subtle">
            <span className="tabular-nums" style={{ fontSize: '9.5px', color: PLANNED_INK }}>7</span>
            {t.plan.monthLegend.plannedKm}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-subtle">
            <span className="tabular-nums" style={{ fontSize: '10px', fontWeight: 700, color: RAN_INK }}>7.0</span>
            {t.plan.monthLegend.ran}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-subtle">
            <span style={{ fontSize: '8.5px', color: EXTRA_INK }}>{t.plan.extra}</span>
            {t.plan.monthLegend.unplanned}
          </span>
        </div>
      </GlassSurface>

      {sheetWorkout && <PlannedWorkoutSheet workout={sheetWorkout} onClose={() => setSheetWorkout(null)} />}
    </div>
  )
}
