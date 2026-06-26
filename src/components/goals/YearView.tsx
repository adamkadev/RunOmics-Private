import Link from 'next/link'
import { Trophy, Target, Medal, TrendingUp, ArrowRight, ArrowDown, Check, Minus, Calendar, Flag, MapPin } from 'lucide-react'
import type { YearData, GoalProjection, MonthGoal } from '@/application/usecases/GetGoalsData'
import { formatDuration, formatDate, formatPace, monthLabel } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { raceDistanceTint } from '@/lib/colors'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const DIST_SHORT: Record<string, string> = { 'Half-Marathon': 'HM' }
function shortDist(d: string) { return DIST_SHORT[d] ?? d }

// Icon-only status indicators: ✓ green (ahead/done), → blue (on track), ↓ amber (behind), - gray (pending)
const STATUS_ICON: Record<MonthGoal['status'], { Icon: typeof Check; className: string }> = {
  ahead:    { Icon: Check,       className: STATUS.success.text },
  on_track: { Icon: ArrowRight,  className: STATUS.progress.text },
  behind:   { Icon: ArrowDown,   className: STATUS.warning.text },
  pending:  { Icon: Minus,       className: 'text-subtle/40' },
}

const MONTH_CELL_TINT: Record<MonthGoal['status'], { bg: string; border: string; bar: string; dashed?: boolean }> = {
  ahead:    { bg: 'rgba(16,185,129,0.06)',         border: 'rgba(16,185,129,0.25)',     bar: 'var(--accent)' },
  on_track: { bg: 'rgba(47,116,224,0.10)',         border: 'rgba(47,116,224,0.28)',     bar: '#7db8ff' },
  behind:   { bg: 'rgba(229,57,107,0.06)',         border: 'rgba(229,57,107,0.25)',     bar: '#e5396b' },
  pending:  { bg: '',                              border: '',                           bar: 'rgba(255,255,255,0.08)', dashed: true },
}

const STATUS_CHIP_BG: Record<GoalProjection['status'], string> = {
  ahead:    STATUS.success.bg,
  on_track: STATUS.progress.bg,
  behind:   STATUS.warning.bg,
}

export function YearView({ yearData }: { yearData: YearData }) {
  const { goals, pbs, upcomingRaces, totalDistanceKm, projection, monthlyGoals } = yearData
  const today = new Date().toISOString().slice(0, 10)

  const annualDistanceKm = goals?.annualDistanceKm ?? 0
  const annualProgress = annualDistanceKm > 0
    ? Math.min((totalDistanceKm / annualDistanceKm) * 100, 100)
    : 0
  const remaining = Math.max(annualDistanceKm - totalDistanceKm, 0)
  const statusIcon = projection ? STATUS_ICON[projection.status] : null

  return (
    <div className="space-y-8 pb-[max(env(safe-area-inset-bottom),80px)]">
      {goals && (
        <section className="space-y-3">
          <GlassSurface variant="card" className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Target size={16} className="text-accent-text" />
              {t.goals.annualGoal}
            </h2>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  {totalDistanceKm.toFixed(0)}
                </span>
                <span className="ml-1 text-sm text-subtle">/ {goals.annualDistanceKm} {t.units.km}</span>
              </div>
              <span className="text-sm font-semibold text-accent-text">
                {annualProgress.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${annualProgress}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--accent-text))',
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              {remaining > 0 ? (
                <span className="text-subtle">{t.goals.kmRemaining(Number(remaining.toFixed(0)))}</span>
              ) : (
                <span className={cn('font-medium', STATUS.success.text)}>{t.goals.goalReached}</span>
              )}
            </div>
            {projection && statusIcon && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className={cn('rounded-full px-2.5 py-0.5 font-semibold', STATUS_CHIP_BG[projection.status], statusIcon.className)}>
                  {t.goals.projection.status[projection.status]}
                </span>
                <span className={cn('flex items-center gap-1 font-medium', statusIcon.className)}>
                  <statusIcon.Icon size={12} strokeWidth={2.5} />
                  {projection.deltaKm !== 0 && `${projection.status === 'ahead' ? '+' : '-'}${Math.abs(projection.deltaKm)} km`}
                </span>
                <span className="w-full text-subtle">
                  {t.goals.projection.rate(projection.weeklyRate, projection.weeklyNeeded)}
                </span>
              </div>
            )}
          </GlassSurface>
        </section>
      )}

      {goals && monthlyGoals.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar size={16} className="text-accent-text" />
            {t.goals.monthlyGoal.title}
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {monthlyGoals.map((mg) => {
              const progress = mg.targetKm > 0 ? Math.min((mg.actualKm / mg.targetKm) * 100, 100) : 0
              const { Icon: StatusIcon, className: statusClassName } = STATUS_ICON[mg.status]
              const tint = MONTH_CELL_TINT[mg.status]
              return (
                <GlassSurface
                  key={mg.month}
                  variant="card"
                  className={cn('rounded-card-sm p-5', tint.dashed && 'border-dashed')}
                  style={tint.bg ? { background: tint.bg, borderColor: tint.border } : undefined}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-subtle">{monthLabel(mg.month)}</span>
                    <StatusIcon
                      size={12}
                      strokeWidth={3}
                      className={statusClassName}
                      aria-label={t.goals.monthlyGoal.status[mg.status]}
                    />
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-foreground">
                    {t.goals.monthlyGoal.km(Math.round(mg.actualKm), Math.round(mg.targetKm))}
                  </p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, background: tint.bar }}
                    />
                  </div>
                </GlassSurface>
              )
            })}
          </div>
        </section>
      )}

      {goals && goals.targets.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp size={16} className="text-accent-text" />
            {t.goals.raceTargets}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {goals.targets.map((target) => {
              const pb = pbs.find((p) => p.entry.distance === target.distance)
              const pbSeconds = pb?.entry.seconds ?? null
              const delta = pbSeconds !== null && target.targetSeconds ? pbSeconds - target.targetSeconds : null
              const achieved = delta !== null && delta <= 0
              return (
                <GlassSurface key={target.distance} variant="card" className="rounded-card-sm p-5">
                  <p className="text-xs font-semibold text-subtle">{shortDist(target.distance)}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {target.targetSeconds === null ? (
                      <span className="text-sm font-normal text-subtle">{t.goals.noTarget}</span>
                    ) : (
                      formatDuration(target.targetSeconds)
                    )}
                  </p>
                  {pbSeconds !== null && delta !== null && (
                    <p className={cn('mt-0.5 text-xs font-medium', achieved ? STATUS.success.text : STATUS.warning.text)}>
                      {achieved
                        ? t.goals.targetDone(formatDuration(Math.abs(delta)))
                        : t.goals.targetToGo(formatDuration(delta))}
                    </p>
                  )}
                </GlassSurface>
              )
            })}
          </div>
        </section>
      )}

      {upcomingRaces.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Flag size={16} className="text-accent-text" />
            {t.goals.upcomingRaces}
          </h2>
          <div className="space-y-2">
            {upcomingRaces.map((race, idx) => {
              const daysUntil = Math.round(
                (new Date(race.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000
              )
              const isPast = race.date < today
              return (
                <GlassSurface key={idx} variant="card" className="flex items-start justify-between gap-3 rounded-card-sm p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{race.name}</span>
                      <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium text-foreground/70">
                        {shortDist(race.distance)}
                      </span>
                    </div>
                    {race.targetSeconds && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-accent-text">
                        <Target size={12} />
                        {formatDuration(race.targetSeconds)}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(race.date)}
                      </span>
                      {race.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {race.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isPast && (
                    <span className={cn('shrink-0 text-xs font-semibold tabular-nums', STATUS.progress.text)}>
                      D-{daysUntil}
                    </span>
                  )}
                  {isPast && (
                    <span className="shrink-0 text-xs text-subtle">{t.goals.pastRace}</span>
                  )}
                </GlassSurface>
              )
            })}
          </div>
        </section>
      )}

      {pbs.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Medal size={16} className="text-accent-text" />
            {t.goals.seasonRaces}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pbs.map(({ entry, activity }) => {
              const tint = raceDistanceTint(entry.distance)
              return (
                <Link
                  key={entry.activityId}
                  href={`/activities/${entry.activityId}`}
                  className="glass-card group relative overflow-hidden rounded-card-sm transition-shadow hover:shadow-lg"
                >
                  <div className={cn('flex h-24 items-center bg-gradient-to-br to-transparent px-5', tint.overlay)}>
                    <span className="text-3xl font-black text-foreground">
                      {shortDist(entry.distance)}
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xl font-bold tracking-tight text-foreground">
                          {formatDuration(entry.seconds)}
                        </p>
                        {activity.paceSecPerKm && (
                          <p className="text-sm text-muted-foreground">
                            {formatPace(activity.paceSecPerKm)}
                          </p>
                        )}
                      </div>
                      <ArrowRight size={16} className="mt-1 shrink-0 text-subtle transition-colors group-hover:text-muted-foreground" />
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-subtle">
                      <Calendar size={12} className="shrink-0" />
                      <span>{formatDate(activity.date)}</span>
                      {activity.description && (
                        <>
                          <span className="text-subtle/40">·</span>
                          <span className="truncate text-muted-foreground">{activity.description}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ) : (
        <GlassSurface variant="card" className="rounded-card-sm border-dashed p-10 text-center">
          <Trophy size={24} className="mx-auto mb-3 text-subtle" />
          <p className="text-sm text-subtle">{t.goals.emptyPbs(yearData.year)}</p>
        </GlassSurface>
      )}
    </div>
  )
}
