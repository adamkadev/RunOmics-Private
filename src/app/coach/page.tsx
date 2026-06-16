import Link from 'next/link'
import { Brain, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getCoachData } from '@/application/usecases/GetCoachData'
import { TrainingStatusBanner } from '@/components/dashboard/TrainingStatusBanner'
import { formatDuration, formatPace } from '@/lib/formatters'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import { t } from '@/i18n'
import type { CoachSuggestion } from '@/application/usecases/GetCoachData'

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

export default function CoachPage() {
  const status = getTrainingStatus()
  const coach = getCoachData()
  const c = t.coach

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{c.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{c.subtitle}</p>
      </div>

      {status && <TrainingStatusBanner status={status} />}

      {!coach && (
        <p className="text-sm text-subtle">{c.noData}</p>
      )}

      {coach && (
        <>
          {/* Week summary + load deltas */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* This week */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-4 text-sm font-semibold text-foreground/80">{c.thisWeek}</h2>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-subtle">Distance</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {coach.week.distanceKm} <span className="text-sm font-normal text-muted-foreground">km</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-subtle">{t.units.km}</span>
                  {coach.week.deltaDistancePct !== null && (
                    <span className={`text-xs font-medium ${coach.week.deltaDistancePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}>
                      {coach.week.deltaDistancePct >= 0 ? '+' : ''}{coach.week.deltaDistancePct}% {c.vsLastWeek}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <span className="text-xs text-subtle">Sessions</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {coach.week.sessions}
                    {coach.week.deltaSessions !== null && (
                      <span className={`ml-2 text-xs font-normal ${coach.week.deltaSessions >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}>
                        {coach.week.deltaSessions >= 0 ? '+' : ''}{coach.week.deltaSessions} {c.vsLastWeek}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

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
                        {value >= 0 ? '' : ''}{value}
                      </span>
                      <DeltaChip value={delta} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

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

          {/* Recent runs */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {c.recentRuns}
            </h2>
            {coach.recentActivities.length === 0 ? (
              <p className="text-sm text-subtle">{c.noRecentRuns}</p>
            ) : (
              <div className="space-y-2">
                {coach.recentActivities.map((a) => {
                  const typeConfig = ACTIVITY_TYPE_CONFIG[a.type]
                  const date = new Date(a.date + 'T00:00:00').toLocaleDateString(t.locale, { weekday: 'short', month: 'short', day: 'numeric' })
                  return (
                    <Link
                      key={a.id}
                      href={`/activities/${a.id}`}
                      className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-card transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${typeConfig.badgeClass}`}>
                          {t.activityTypes[a.type]}
                        </span>
                        <span className="text-xs text-subtle">{date}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-semibold tabular-nums text-foreground">{a.distanceKm.toFixed(1)} km</span>
                        {a.paceSecPerKm && <span className="text-xs text-subtle">{formatPace(a.paceSecPerKm)}</span>}
                        <span className="text-xs text-subtle">{formatDuration(a.durationSeconds)}</span>
                        <ArrowRight size={14} className="text-muted-foreground" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
