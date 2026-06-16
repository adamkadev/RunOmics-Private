import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import { t } from '@/i18n'
import type { CoachData, CoachSuggestion, CoachTypeBreakdown } from '@/application/usecases/GetCoachData'
import type { TrainingPlanData, TrainingPlanWeek } from '@/application/usecases/GetTrainingPlan'

const PLAN_FOCUS_STYLE: Record<string, string> = {
  recovery: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  maintain: 'bg-muted text-muted-foreground',
  build:    'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  quality:  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const SUGGESTION_STYLE: Record<string, { border: string; icon: string; badge: string }> = {
  reduce_load:      { border: 'border-red-200 dark:border-red-800',    icon: 'text-red-500',    badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  fatigue_high:     { border: 'border-orange-200 dark:border-orange-800', icon: 'text-orange-500', badge: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  easy_session:     { border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-500',  badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  quality_window:   { border: 'border-emerald-200 dark:border-emerald-800', icon: 'text-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  add_sessions:     { border: 'border-blue-200 dark:border-blue-800',   icon: 'text-blue-500',   badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  increase_volume:  { border: 'border-blue-200 dark:border-blue-800',   icon: 'text-blue-500',   badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  maintain:         { border: 'border-border',                           icon: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground' },
}

function DeltaChip({ value }: { value: number }) {
  if (value > 0) return <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"><TrendingUp size={12} />+{value}</span>
  if (value < 0) return <span className="flex items-center gap-0.5 text-orange-500 dark:text-orange-400"><TrendingDown size={12} />{value}</span>
  return <span className="flex items-center gap-0.5 text-subtle"><Minus size={12} />0</span>
}

function WeekStatsCard({
  title,
  distanceKm,
  sessions,
  deltaDistancePct,
  deltaSessions,
  deltaLabel,
}: {
  title: string
  distanceKm: number
  sessions: number
  deltaDistancePct: number | null
  deltaSessions: number | null
  deltaLabel: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="mb-4 text-sm font-semibold text-foreground/80">{title}</h2>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-subtle">{t.coach.stats.distance}</span>
          <span className="text-lg font-bold tabular-nums text-foreground">
            {distanceKm} <span className="text-sm font-normal text-muted-foreground">km</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-subtle">{t.units.km}</span>
          {deltaDistancePct !== null && (
            <span className={`text-xs font-medium ${deltaDistancePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}>
              {deltaDistancePct >= 0 ? '+' : ''}{deltaDistancePct}% {deltaLabel}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-xs text-subtle">{t.coach.stats.sessions}</span>
          <span className="text-lg font-bold tabular-nums text-foreground">
            {sessions}
            {deltaSessions !== null && (
              <span className={`ml-2 text-xs font-normal ${deltaSessions >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}>
                {deltaSessions >= 0 ? '+' : ''}{deltaSessions} {deltaLabel}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

function SessionTypeBreakdownCard({ breakdown, totalKm }: { breakdown: CoachTypeBreakdown[]; totalKm: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="mb-4 text-sm font-semibold text-foreground/80">{t.coach.sessionTypes}</h2>
      <div className="space-y-3">
        {breakdown.map((b) => {
          const typeConfig = ACTIVITY_TYPE_CONFIG[b.type]
          const pct = totalKm > 0 ? Math.round((b.distanceKm / totalKm) * 100) : 0
          return (
            <div key={b.type} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className={`rounded-md px-2 py-0.5 font-semibold ${typeConfig.badgeClass}`}>
                  {t.activityTypes[b.type]}
                </span>
                <span className="text-subtle">{t.coach.sessions(b.sessions)} &middot; {b.distanceKm} km</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: typeConfig.chartColor }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlanWeekRow({ week }: { week: TrainingPlanWeek }) {
  const start = new Date(week.startDate + 'T00:00:00')
  const end = new Date(start.getTime() + 6 * 86_400_000)
  const range = `${start.toLocaleDateString(t.locale, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(t.locale, { month: 'short', day: 'numeric' })}`

  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">{t.coach.planWeek(week.weekIndex)}</span>
          <span className="text-xs text-subtle">{range}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold tabular-nums text-foreground">{week.targetDistanceKm} km</span>
          <span className="text-xs text-subtle">{t.coach.sessions(week.targetSessions)}</span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${PLAN_FOCUS_STYLE[week.focus]}`}>
            {t.coach.planFocus[week.focus]}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t.coach.planFocusDetail[week.focus]}</p>
    </div>
  )
}

function SuggestionCard({ s }: { s: CoachSuggestion }) {
  const style = SUGGESTION_STYLE[s.key] ?? SUGGESTION_STYLE.maintain
  const entry = t.coach.suggestion[s.key]
  if (!entry) return null
  const detail = typeof entry.detail === 'function' ? (entry.detail as (n: number) => string)(s.acwr ?? 0) : entry.detail

  return (
    <div className={`rounded-xl border bg-card p-4 shadow-card ${style.border}`}>
      <div className="flex items-start gap-3">
        <Brain size={16} className={`mt-0.5 shrink-0 ${style.icon}`} />
        <div>
          <p className="text-sm font-semibold text-foreground">{entry.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  )
}

interface Props {
  coach: CoachData
  plan: TrainingPlanData | null
}

export function CoachOverview({ coach, plan }: Props) {
  const c = t.coach

  return (
    <>
      {/* Week summary + load deltas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WeekStatsCard
          title={c.thisWeek}
          distanceKm={coach.week.distanceKm}
          sessions={coach.week.sessions}
          deltaDistancePct={coach.week.deltaDistancePct}
          deltaSessions={coach.week.deltaSessions}
          deltaLabel={c.vsLastWeek}
        />

        {/* Load deltas */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-foreground/80">{c.loadChanges}</h2>
          <div className="space-y-3">
            {(
              [
                { label: c.fitness, value: coach.loadDelta.ctl,    delta: coach.loadDelta.ctlDelta7d },
                { label: c.fatigue, value: coach.loadDelta.atl,    delta: coach.loadDelta.atlDelta7d },
                { label: c.form,    value: coach.loadDelta.tsb,    delta: coach.loadDelta.tsbDelta7d },
              ] as const
            ).map(({ label, value, delta }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-subtle">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {value}
                  </span>
                  <DeltaChip value={delta} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Year-over-year + session type breakdown */}
      {(coach.yearOverYear || coach.sessionTypeBreakdown.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {coach.yearOverYear && (
            <WeekStatsCard
              title={c.vsLastYear}
              distanceKm={coach.week.distanceKm}
              sessions={coach.week.sessions}
              deltaDistancePct={coach.yearOverYear.deltaDistancePct}
              deltaSessions={coach.yearOverYear.deltaSessions}
              deltaLabel={c.vsLastYearLabel}
            />
          )}
          {coach.sessionTypeBreakdown.length > 0 && (
            <SessionTypeBreakdownCard breakdown={coach.sessionTypeBreakdown} totalKm={coach.week.distanceKm} />
          )}
        </div>
      )}

      {/* Suggestions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {c.suggestions}
        </h2>
        <div className="space-y-2">
          {coach.suggestions.map((s) => (
            <SuggestionCard key={s.key} s={s} />
          ))}
        </div>
      </section>

      {/* 4-week training plan */}
      {plan && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {c.planTitle}
            </h2>
            <p className="mt-0.5 text-xs text-subtle">{c.planSubtitle(plan.goalWeeklyNeeded)}</p>
          </div>
          <div className="space-y-2">
            {plan.weeks.map((w) => (
              <PlanWeekRow key={w.weekIndex} week={w} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
