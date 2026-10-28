'use client'

import { useMemo, type CSSProperties, type MouseEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ActivityType, PlannedWorkout } from '@/domain/activity/types'
import type { PlanRun } from './planRun'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { isKeyPrescription } from '@/components/coaching/presentation'
import { cardClass } from '@/components/ui/Card'
import { zoneColor } from '@/lib/colors'
import { ZONE_TILE_SHARE } from '@/lib/themeTokens'
import { isoDate, startOfWeek } from '@/lib/calendarDate'
import { formatDate, formatRanKm, formatWeekday } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { PlanCoachingView, PlanPrescriptionView } from './planCoachingView'
import { PlanPeriodNav } from './PlanPeriodNav'
import { monthDays, type MonthDayState } from '@/domain/training/monthDays'
import { useSkippedDays } from '@/lib/skippedDays'
import { planPhaseSpans, spanOfWeek, spanWeeks, type PhaseSpan } from './planPhaseSpans'
import { dayKind, kindColor, kindLetter, type DayKind } from './sessionKind'
import { sessionTitle } from './sessionTitle'
import { formatWeekKm } from './weekPlanDays'

interface Props {
  year: number
  month: number
  byDate: Map<string, PlanRun[]>
  byDatePlanned: Map<string, PlannedWorkout>
  byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>
  coaching?: PlanCoachingView | null
  planPhaseRanges?: PlanPhaseRange[]
  today: string
  atPresent: boolean
  onToday: () => void
  onSelectDay: (date: string) => void
  onPrev: () => void
  onNext: () => void
  canGoForward: boolean
}

const GRID = 'grid grid-cols-[repeat(7,minmax(0,1fr))_56px]'

interface Planned {
  km: number | null
  minutes: number | null
}

function plannedFor(date: string, byDatePlanned: Map<string, PlannedWorkout>, byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>): Planned | null {
  const coach = byDateCoach?.get(date)?.find((v) => v.state !== 'cancelled')
  if (coach) {
    const meters = coach.distanceMeters
    const seconds = coach.prescription.totalDurationSeconds
    return { km: meters ? meters / 1000 : null, minutes: seconds ? Math.round(seconds / 60) : null }
  }
  // A Garmin session planned by time alone is still a session.
  const plan = byDatePlanned.get(date)
  if (plan && (plan.distanceM || plan.durationSecs)) {
    return { km: plan.distanceM ? plan.distanceM / 1000 : null, minutes: plan.durationSecs ? Math.round(plan.durationSecs / 60) : null }
  }
  return null
}

interface Cell {
  date: string
  outside: boolean
  state: MonthDayState
  kind: DayKind | null
  ranKm: number
  planned: Planned | null
}

interface Row {
  monday: string
  cells: Cell[]
  span: PhaseSpan | null
  label: string | null
  ranKm: number
  plannedKm: number
  current: boolean
  future: boolean
}

function tileStyle(cell: Cell): CSSProperties | null {
  const color = cell.kind?.color ?? 'var(--muted-foreground)'
  if (cell.state === 'done' || cell.state === 'extra')
    return {
      background: `color-mix(in srgb, ${color} ${ZONE_TILE_SHARE * 100}%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 50%, transparent)`,
    }
  if (cell.state === 'planned') return { border: `1px dashed ${color}` }
  if (cell.state === 'missed') return { border: '1px dashed var(--warn)' }
  return null
}

function tileFigure(cell: Cell): string | null {
  if (cell.ranKm > 0) return formatRanKm(cell.ranKm)
  if (!cell.planned) return null
  return cell.planned.km !== null ? formatWeekKm(cell.planned.km) : cell.planned.minutes !== null ? t.plan.steps.minutes(cell.planned.minutes) : null
}

function nextKeySession(
  from: string,
  byDatePlanned: Map<string, PlannedWorkout>,
  byDateCoach?: ReadonlyMap<string, PlanPrescriptionView[]>,
): { date: string; title: string } | null {
  const dates = [...new Set([...byDatePlanned.keys(), ...(byDateCoach?.keys() ?? [])])].filter((d) => d >= from).sort()
  for (const date of dates) {
    const coach = byDateCoach?.get(date)?.find((v) => v.state !== 'cancelled')
    if (coach) {
      if (isKeyPrescription(coach.prescription)) return { date, title: coach.prescription.shortName ?? coach.prescription.title }
      continue
    }
    const plan = byDatePlanned.get(date)
    if (plan?.type && plan.type !== 'Base') return { date, title: sessionTitle(plan.name, plan.type) ?? t.activityTypes[plan.type] }
  }
  return null
}

const QUALITY_ORDER: ActivityType[] = ['Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Sprint', 'Race']

function Swatch({ style }: { style: CSSProperties }) {
  return <span aria-hidden className="box-border size-2.5 shrink-0 rounded-[3px]" style={style} />
}

export function MonthView({
  year,
  month,
  byDate,
  byDatePlanned,
  byDateCoach,
  coaching = null,
  planPhaseRanges = [],
  today,
  atPresent,
  onToday,
  onSelectDay,
  onPrev,
  onNext,
  canGoForward,
}: Props) {
  const monthStart = isoDate(new Date(year, month, 1))
  const monthEnd = isoDate(new Date(year, month + 1, 0))
  const spans = useMemo(() => planPhaseSpans(coaching, planPhaseRanges), [coaching, planPhaseRanges])
  const currentSpan = spanOfWeek(spans, isoDate(startOfWeek(new Date(`${today}T00:00:00`))))

  const skipped = useSkippedDays()
  const { rows, ranKm, plannedKm, planSpan, ranInPlanKm, qualityTypes, hasLong } = useMemo(() => {
    const first = new Date(year, month, 1)
    const startOffset = (first.getDay() || 7) - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cellCount = Math.ceil((startOffset + daysInMonth) / 7) * 7
    const dates = Array.from({ length: cellCount }, (_, i) => isoDate(new Date(year, month, 1 - startOffset + i)))
    const states = monthDays(dates, (d) => (byDate.get(d)?.length ?? 0) > 0, (d) => plannedFor(d, byDatePlanned, byDateCoach) !== null, today)

    let ranKm = 0
    let plannedKm = 0
    const quality = new Set<ActivityType>()
    let hasLong = false
    const rows: Row[] = []
    let previous: PhaseSpan | null = null
    for (let r = 0; r < dates.length / 7; r++) {
      const cells = dates.slice(r * 7, r * 7 + 7).map((date): Cell => {
        const acts = byDate.get(date) ?? []
        const kind = dayKind(date, acts, byDatePlanned, byDateCoach)
        const state = states.get(date)?.state ?? 'rest'
        const cell: Cell = {
          date,
          outside: date < monthStart || date > monthEnd,
          state: state === 'missed' && skipped.has(date) ? 'rest' : state,
          kind,
          ranKm: acts.reduce((s, a) => s + a.distanceKm, 0),
          planned: plannedFor(date, byDatePlanned, byDateCoach),
        }
        if (kind?.kind === 'quality') quality.add(kind.type)
        if (kind?.kind === 'long') hasLong = true
        if (!cell.outside) {
          ranKm += cell.ranKm
          plannedKm += cell.planned?.km ?? 0
        }
        return cell
      })
      const monday = cells[0]!.date
      const sunday = cells[6]!.date
      const span = spanOfWeek(spans, monday)
      const label =
        span && span !== previous
          ? span.startDate < monday && r === 0
            ? t.plan.month.phaseEnds(span.shortName, formatDate(span.endDate, { style: 'bare' }))
            : t.plan.month.phaseWeeks(span.shortName, spanWeeks(span))
          : null
      previous = span
      rows.push({
        monday,
        cells,
        span,
        label,
        ranKm: cells.reduce((s, c) => s + c.ranKm, 0),
        plannedKm: cells.reduce((s, c) => s + (c.planned?.km ?? 0), 0),
        current: monday <= today && today <= sunday,
        future: monday > today,
      })
    }
    // A plan that starts partway through the month can't be measured against
    // the whole month's km.
    const covered = rows.flatMap((row) => row.cells).filter((c) => !c.outside && c.planned !== null)
    const firstPlanned = covered[0]
    const lastPlanned = covered[covered.length - 1]
    const ranInPlanKm = covered.reduce((sum, c) => sum + c.ranKm, 0)
    const planSpan =
      firstPlanned && lastPlanned && (firstPlanned.date > monthStart || lastPlanned.date < monthEnd)
        ? { from: firstPlanned.date, to: lastPlanned.date }
        : null
    return { rows, ranKm, plannedKm, planSpan, ranInPlanKm, qualityTypes: QUALITY_ORDER.filter((type) => quality.has(type)), hasLong }
  }, [year, month, monthStart, monthEnd, byDate, byDatePlanned, byDateCoach, spans, today, skipped])

  /** The km the plan's own days got, so the two sides of "of" are the same days. */
  const againstPlanKm = planSpan === null ? ranKm : ranInPlanKm

  const phaseColor = (span: PhaseSpan | null) => (!span ? 'transparent' : span === currentSpan ? 'var(--accent)' : 'var(--zone-1)')

  function openRow(row: Row, event: MouseEvent<HTMLButtonElement>) {
    const date = (event.target as HTMLElement).closest<HTMLElement>('[data-date]')?.dataset.date
    onSelectDay(date ?? (row.current ? today : row.monday))
  }

  const monthName = formatDate(monthStart, { precision: 'month', style: 'full', year: 'never' })
  const key = monthEnd >= today ? nextKeySession(monthStart > today ? monthStart : today, byDatePlanned, byDateCoach) : null
  const m = t.plan.month

  return (
    <div className="flex flex-col gap-3.5">
      <PlanPeriodNav
        label={formatDate(monthStart, { precision: 'month', style: 'full', year: 'always' })}
        onPrev={onPrev}
        onNext={onNext}
        nextDisabled={atPresent && !canGoForward}
        onToday={atPresent ? null : onToday}
      />

      <div>
        <div className={cn(GRID, 'pb-1.5 pl-[3px] text-center text-[11px] text-muted-foreground')} aria-hidden>
          {t.plan.weekdays.map((d, i) => (
            <span key={i}>{d.slice(0, 1)}</span>
          ))}
          <span className="pr-1 text-right">{t.units.km}</span>
        </div>

        <div className="flex flex-col gap-1.5" data-testid="month-grid">
          {rows.map((row) => (
            <div key={row.monday}>
              {row.label && (
                <p
                  data-testid="month-phase-label"
                  className="flex items-center gap-1.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: row.span === currentSpan ? 'var(--accent-text)' : 'var(--zone-1-text)' }}
                >
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: phaseColor(row.span) }} />
                  {row.label}
                </p>
              )}
              <button
                type="button"
                data-testid="month-week"
                data-current={row.current || undefined}
                onClick={(event) => openRow(row, event)}
                aria-label={m.weekLabel(
                  formatDate(row.monday, { style: 'bare' }),
                  row.plannedKm > 0 ? `${formatRanKm(row.ranKm)} ${t.plan.weekRow.kmOf(formatWeekKm(row.plannedKm))}` : `${formatRanKm(row.ranKm)} ${t.units.km}`,
                )}
                className={cn(GRID, 'w-full items-center rounded-r-xl border-l-[3px] py-1.5 text-left transition-colors hover:bg-[var(--surface-2)]', row.current && 'bg-card')}
                style={{ borderLeftColor: phaseColor(row.span) }}
              >
                {row.cells.map((cell) => {
                  const isToday = cell.date === today
                  const figure = tileFigure(cell)
                  const style = tileStyle(cell)
                  return (
                    <span
                      key={cell.date}
                      data-date={cell.date}
                      data-cell-state={cell.state}
                      data-outside-month={cell.outside || undefined}
                      className={cn('flex min-w-0 flex-col items-center gap-1', cell.outside && 'opacity-40')}
                    >
                      <span
                        className={cn(
                          'flex size-[22px] items-center justify-center rounded-full text-xs tabular-nums',
                          isToday ? 'bg-accent font-semibold text-accent-foreground' : 'text-foreground',
                        )}
                      >
                        {Number(cell.date.slice(8))}
                      </span>
                      <span
                        data-testid="month-tile"
                        className={cn(
                          'box-border flex h-[34px] w-full max-w-[40px] items-center justify-center rounded-[9px] text-xs font-semibold tabular-nums',
                          cell.state === 'missed' ? 'text-[var(--warn)]' : 'text-foreground',
                        )}
                        style={style ?? undefined}
                      >
                        {/* VO2 Max, Sprint, Anaerobic and Race share zone 5's
                            colour: the letter tells them apart. */}
                        {style && cell.kind?.kind === 'quality' ? (
                          <span className="flex flex-col items-center leading-none">
                            <span className="text-[11px] font-bold" style={{ color: cell.kind.text }}>
                              {kindLetter(cell.kind.type, cell.kind.kind)}
                            </span>
                            {figure && <span className="text-[11px] font-semibold">{figure}</span>}
                          </span>
                        ) : style ? (
                          figure
                        ) : null}
                      </span>
                    </span>
                  )
                })}
                <span data-testid="month-week-total" className="flex min-w-0 flex-col items-end pr-1 leading-tight tabular-nums">
                  <span className={cn('text-sm font-semibold', row.future ? 'text-muted-foreground' : row.current ? 'text-accent-text' : 'text-foreground')}>
                    {row.future ? '–' : formatRanKm(row.ranKm)}
                  </span>
                  {row.plannedKm > 0 && <span className="text-[11px] text-muted-foreground">/ {formatWeekKm(row.plannedKm)}</span>}
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground" data-testid="month-legend">
        {/* Easy and Long share the blue by design: one entry, named for both. */}
        <span className="flex items-center gap-1.5" data-testid="legend-easy">
          <Swatch style={{ background: zoneColor(2) }} />
          {hasLong ? m.easyLong : t.plan.kinds.easy}
        </span>
        {qualityTypes.map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <Swatch style={{ background: kindColor(type) }} />
            {t.activityTypes[type]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <Swatch style={{ border: '1px dashed var(--muted-foreground)' }} />
          {t.sessionState.planned}
        </span>
      </div>

      <section className={cardClass({ className: 'flex flex-col gap-2.5' })} data-testid="month-summary">
        <h2 className="text-headline text-foreground">{monthName}</h2>
        {plannedKm > 0 && (
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-[var(--line-2)]">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((againstPlanKm / plannedKm) * 100))}%` }} />
          </div>
        )}
        <p className="text-xs text-muted-foreground" data-testid="month-km">
          {plannedKm > 0 ? m.kmOf(formatRanKm(againstPlanKm), formatWeekKm(plannedKm)) : `${formatRanKm(ranKm)} ${t.units.km}`}
          {plannedKm > 0 && planSpan !== null && (
            <>
              {' · '}
              {m.planCovers(formatDate(planSpan.from, { style: 'bare', year: 'never' }), formatDate(planSpan.to, { style: 'bare', year: 'never' }))}
              {' · '}
              {m.monthTotal(formatRanKm(ranKm))}
            </>
          )}
        </p>
        {key && (
          <button
            type="button"
            onClick={() => onSelectDay(key.date)}
            data-testid="month-next-key"
            className="-mx-1 mt-1 flex items-center justify-between gap-3 rounded-lg border-t border-border px-1 pt-3 text-left"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-xs text-muted-foreground">{m.nextKey}</span>
              <span className="truncate text-[15px] font-semibold text-foreground">{`${formatWeekday(key.date, true)} · ${key.title}`}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-accent-text" />
          </button>
        )}
      </section>
    </div>
  )
}
