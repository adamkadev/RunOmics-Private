'use client'

import { useId, useMemo, useState } from 'react'
import { Calendar, Check, ChevronRight, Footprints, HelpCircle, X } from 'lucide-react'
import type { Activity, ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { ACTIVITY_TYPE_CONFIG, ACTIVITY_TYPE_ICONS } from '@/domain/activity/types'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ActivitySheet } from './ActivitySheet'
import { NavArrow, TodayButton } from './CalendarNav'
import { PlannedWorkoutSheet } from './PlannedWorkoutSheet'
import { addDays, isoDate } from '@/lib/calendarDate'
import { formatDate, formatDateFull } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const TODAY = 'var(--color-today)'
const MISSED = 'var(--color-missed)'
// alpha variants via color-mix (supported Safari 16.2+, all modern browsers)
const TODAY_10 = 'color-mix(in srgb, var(--color-today) 10%, transparent)'
const TODAY_33 = 'color-mix(in srgb, var(--color-today) 33%, transparent)'
const TODAY_38 = 'color-mix(in srgb, var(--color-today) 38%, transparent)'
const MISSED_10 = 'color-mix(in srgb, var(--color-missed) 10%, transparent)'
const MISSED_25 = 'color-mix(in srgb, var(--color-missed) 25%, transparent)'

interface Day {
  date: string
  day: number
  acts: Activity[]
}

function PlannedWorkoutRow({ plan, onTap }: { plan: PlannedWorkout; onTap: () => void }) {
  const typeColor = plan.type ? ACTIVITY_TYPE_CONFIG[plan.type as ActivityType].dotColor : null
  const Icon = plan.type ? ACTIVITY_TYPE_ICONS[plan.type as ActivityType] : Footprints

  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-dashed p-3 text-left transition-colors',
        !typeColor && 'border-accent/35 bg-accent/[0.04] hover:bg-accent/[0.07]'
      )}
      style={typeColor ? { borderColor: `${typeColor}59`, background: `${typeColor}14` } : undefined}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
          !typeColor && 'border-accent/30 bg-accent/10'
        )}
        style={typeColor ? { background: `${typeColor}1a`, borderColor: `${typeColor}44` } : undefined}
      >
        <Icon
          size={16}
          strokeWidth={2.2}
          style={typeColor ? { color: typeColor } : undefined}
          className={!typeColor ? 'text-accent' : undefined}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">{plan.name}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {[
            plan.scheduledTime,
            plan.type ? t.activityTypes[plan.type as ActivityType] : null,
            plan.durationSecs ? `~${Math.round(plan.durationSecs / 60)} min` : null,
          ]
            .filter(Boolean)
            .join(' · ') || t.calendar.planned}
        </span>
      </span>
      <ChevronRight
        size={16}
        className={cn('shrink-0', !typeColor && 'text-accent/40')}
        style={typeColor ? { color: `${typeColor}66` } : undefined}
      />
    </button>
  )
}

/** Compact row for the next-week preview: a color dot instead of a type icon, date+time as the
 * primary line since several rows are listed together (the workout name doesn't fit the format). */
function NextWeekPlanRow({ plan, onTap }: { plan: PlannedWorkout; onTap: () => void }) {
  const typeColor = plan.type ? ACTIVITY_TYPE_CONFIG[plan.type as ActivityType].dotColor : null
  const meta =
    [
      plan.type ? t.activityTypes[plan.type as ActivityType] : null,
      plan.durationSecs ? `~${Math.round(plan.durationSecs / 60)} min` : null,
    ]
      .filter(Boolean)
      .join(' · ') || t.calendar.planned

  return (
    <button
      type="button"
      onClick={onTap}
      className="flex w-full items-center gap-2.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-2.5 text-left transition-colors hover:bg-foreground/[0.07]"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: typeColor ?? 'var(--accent)' }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">
          {formatDate(plan.date)}
          {plan.scheduledTime ? ` · ${plan.scheduledTime}` : ''}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{meta}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-foreground/30" />
    </button>
  )
}

interface Props {
  weekStart: Date
  byDate: Map<string, Activity[]>
  byDatePlanned: Map<string, PlannedWorkout>
  today: string
  atPresent: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function WeekView({ weekStart, byDate, byDatePlanned, today, atPresent, onPrev, onNext, onToday }: Props) {
  const days: Day[] = Array.from({ length: 7 }, (_, i) => {
    const date = isoDate(addDays(weekStart, i))
    return { date, day: Number(date.slice(8)), acts: byDate.get(date) ?? [] }
  })

  const [selectedDate, setSelectedDate] = useState(
    () => days.find((d) => d.date === today)?.date ?? days[0].date
  )
  const [sheetActivity, setSheetActivity] = useState<Activity | null>(null)
  const [sheetPlan, setSheetPlan] = useState<PlannedWorkout | null>(null)
  const [showLegend, setShowLegend] = useState(false)
  const legendId = useId()

  const selected = days.find((d) => d.date === selectedDate) ?? days[0]
  const selectedPlan = byDatePlanned.get(selected.date)

  const nextWeekPlans = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, 7 + i)))
        .map((date) => byDatePlanned.get(date))
        .filter((p): p is PlannedWorkout => !!p),
    [weekStart, byDatePlanned]
  )

  return (
    <div className="space-y-3">
      <GlassSurface variant="card" className="rounded-card-sm p-3.5 pb-2.5">
        {/* Today jump + legend toggle share one row; legend renders inline next to the toggle, not below it */}
        <div className="flex items-center justify-between gap-2">
          {!atPresent ? <TodayButton onClick={onToday} /> : <span />}

          <div className="flex items-center gap-2.5">
            {showLegend && (
              <div id={legendId} className="flex flex-wrap items-center gap-2.5 text-micro text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Check size={10} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
                  {t.calendar.legend.completed}
                </span>
                <span className="flex items-center gap-1">
                  <X size={10} strokeWidth={2.5} style={{ color: MISSED }} />
                  {t.calendar.legend.missed}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full border" style={{ borderColor: 'rgba(255,255,255,.35)' }} />
                  {t.calendar.planned}
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-foreground/30">-</span>
                  {t.calendar.restDay}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowLegend((v) => !v)}
              aria-expanded={showLegend}
              aria-controls={legendId}
              aria-label={t.calendar.legend.toggleLabel}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/30 transition-colors hover:text-foreground/60"
            >
              <HelpCircle size={15} />
            </button>
          </div>
        </div>

        {/* Grid flanked by prev/next so the nav row above doesn't need its own arrows */}
        <div className="flex items-center gap-1.5">
          <NavArrow direction="prev" onClick={onPrev} />

          <div className="min-w-0 flex-1">
            {/* Weekday labels */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {t.calendar.weekdays.map((label, i) => (
                <div
                  key={label}
                  className="text-center font-mono text-micro font-semibold text-muted-foreground/50"
                  style={days[i].date === today ? { color: TODAY, fontWeight: 700 } : undefined}
                >
                  {label[0]}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const isToday = d.date === today
                const isPast = d.date < today
                const completed = d.acts.length > 0
                const plan = byDatePlanned.get(d.date)
                const planned = !completed && !!plan
                const missed = isPast && planned
                const primaryType: ActivityType | null = completed ? d.acts[0].type : null

                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setSelectedDate(d.date)}
                    className={cn(
                      'flex min-h-[44px] flex-col items-center gap-1 rounded-lg py-0.5 transition-transform active:scale-95',
                      d.date === selectedDate && 'bg-foreground/[0.06]'
                    )}
                  >
                    {/* Cell box */}
                    <div className="relative flex h-8 w-8 items-center justify-center">
                      {/* Pulse ring for today: opacity-only animation, not scale+fade */}
                      {isToday && !completed && (
                        <div
                          className="absolute inset-0 rounded-[8px] border"
                          style={{
                            borderColor: TODAY_38,
                            animation: 'pulse-ring 2s ease-in-out infinite',
                          }}
                        />
                      )}

                      <div
                        className="relative flex h-8 w-8 items-center justify-center rounded-[8px] border transition-colors"
                        style={
                          completed
                            ? { background: 'var(--color-accent, #f1761f)26', borderColor: 'var(--color-accent, #f1761f)4d' }
                            : missed
                              ? { background: MISSED_10, borderColor: MISSED_25, opacity: 0.6 }
                              : isToday
                                ? { background: TODAY_10, borderColor: TODAY, borderStyle: 'solid' }
                                : planned
                                  ? { background: 'rgba(255,255,255,.05)', borderColor: 'rgba(255,255,255,.18)', borderStyle: 'dashed' }
                                  : { background: 'rgba(0,0,0,.04)', borderColor: 'rgba(0,0,0,.07)' }
                        }
                      >
                        {completed ? (
                          <Check size={12} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
                        ) : missed ? (
                          <X size={12} strokeWidth={2.5} style={{ color: MISSED }} />
                        ) : planned ? (
                          <span
                            className="h-2 w-2 rounded-full border"
                            style={isToday ? { borderColor: TODAY } : { borderColor: 'rgba(255,255,255,.35)' }}
                          />
                        ) : isToday ? (
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TODAY }} />
                        ) : (
                          <span className="text-caption text-foreground/20">-</span>
                        )}
                      </div>
                    </div>

                    {/* Day number */}
                    <span
                      className="text-micro"
                      style={
                        isToday
                          ? { color: TODAY, fontWeight: 700 }
                          : completed
                            ? { color: 'var(--color-foreground)', opacity: 0.7 }
                            : missed
                              ? { color: MISSED, opacity: 0.7 }
                              : planned
                                ? { color: 'var(--color-foreground)', opacity: 0.45 }
                                : { color: 'var(--color-foreground)', opacity: 0.25 }
                      }
                    >
                      {d.day}
                    </span>

                    {/* Bottom type bar */}
                    <div
                      className="h-1 w-[18px] rounded-full"
                      style={{
                        backgroundColor: completed
                          ? ACTIVITY_TYPE_CONFIG[primaryType as ActivityType].dotColor
                          : planned
                            ? isToday
                              ? TODAY_33
                              : 'rgba(255,255,255,.12)'
                            : 'transparent',
                      }}
                    />
                  </button>
                )
              })}
            </div>
          </div>

          <NavArrow direction="next" onClick={onNext} disabled={atPresent} />
        </div>
      </GlassSurface>

      {/* Selected day panel */}
      <GlassSurface
        variant="card"
        className={cn('rounded-card-sm p-4', selected.date === today && 'border-accent/30')}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">
            {formatDateFull(selected.date)}
          </span>
          {selected.date === today && (
            <span className="text-caption font-semibold text-muted-foreground">{t.calendar.today}</span>
          )}
        </div>

        {selected.acts.length > 0 ? (
          <div className="space-y-2">
            {selected.acts.map((a) => {
              const ActIcon = ACTIVITY_TYPE_ICONS[a.type]
              return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSheetActivity(a)}
                className="flex w-full items-center gap-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3 text-left transition-colors hover:bg-foreground/[0.07]"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                  style={{
                    background: `${ACTIVITY_TYPE_CONFIG[a.type].dotColor}1a`,
                    borderColor: `${ACTIVITY_TYPE_CONFIG[a.type].dotColor}44`,
                  }}
                >
                  <ActIcon size={16} strokeWidth={2.2} style={{ color: ACTIVITY_TYPE_CONFIG[a.type].dotColor }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {a.description || t.activityTypes[a.type]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.activityTypes[a.type]} · {a.distanceKm.toFixed(1)} {t.units.km}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-foreground/30" />
              </button>
              )
            })}
          </div>
        ) : selectedPlan ? (
          <PlannedWorkoutRow plan={selectedPlan} onTap={() => setSheetPlan(selectedPlan)} />
        ) : (
          <p className="text-sm text-subtle">{t.calendar.restDay}</p>
        )}
      </GlassSurface>

      {nextWeekPlans.length > 0 && (
        <GlassSurface variant="card" className="rounded-card-sm p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent-text">
            <Calendar size={13} strokeWidth={2.4} />
            {t.calendar.nextWeek(nextWeekPlans.length)}
          </p>
          <div className="space-y-2">
            {nextWeekPlans.map((plan) => (
              <NextWeekPlanRow key={plan.date} plan={plan} onTap={() => setSheetPlan(plan)} />
            ))}
          </div>
        </GlassSurface>
      )}

      {sheetActivity && <ActivitySheet activity={sheetActivity} onClose={() => setSheetActivity(null)} />}
      {sheetPlan && <PlannedWorkoutSheet workout={sheetPlan} onClose={() => setSheetPlan(null)} />}
    </div>
  )
}
