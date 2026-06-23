import Image from 'next/image'
import Link from 'next/link'
import { Trophy, Target, Medal, TrendingUp, ArrowRight, Calendar, ImageOff, Flag, MapPin, ExternalLink, Check, X, Minus } from 'lucide-react'
import type { YearData, GoalProjection, MonthGoal } from '@/application/usecases/GetGoalsData'
import { formatDuration, formatDate, formatPace, monthLabel } from '@/lib/formatters'
import { ActivityTypeTag } from '@/components/activities/ActivityTypeTag'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { raceDistanceTint } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const STATUS_CHIP: Record<GoalProjection['status'], string> = {
  ahead:    'bg-accent-subtle text-accent-text',
  on_track: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  behind:   'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

// Icon-only status, no label/unit in the badge - color carries the meaning (DA Wave 3).
const MONTH_STATUS_ICON: Record<MonthGoal['status'], { Icon: typeof Check; className: string }> = {
  ahead:    { Icon: Check, className: 'text-accent-text' },
  on_track: { Icon: ArrowRight, className: 'text-blue-500 dark:text-blue-400' },
  behind:   { Icon: X, className: 'text-amber-500 dark:text-amber-400' },
  pending:  { Icon: Minus, className: 'text-subtle/40' },
}

export function YearView({ yearData }: { yearData: YearData }) {
  const { goals, pbs, upcomingRaces, totalDistanceKm, projection, monthlyGoals } = yearData
  const today = new Date().toISOString().slice(0, 10)

  const annualDistanceKm = goals?.annualDistanceKm ?? 0
  const annualProgress = annualDistanceKm > 0
    ? Math.min((totalDistanceKm / annualDistanceKm) * 100, 100)
    : 0
  const remaining = Math.max(annualDistanceKm - totalDistanceKm, 0)

  return (
    <div className="space-y-8">
      {goals && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Target size={14} className="text-accent-text" />
            {t.goals.annualGoal}
          </h2>
          <GlassSurface variant="card" className="rounded-[22px] p-5">
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
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${annualProgress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              {remaining > 0 ? (
                <span className="text-subtle">{t.goals.kmRemaining(Number(remaining.toFixed(0)))}</span>
              ) : (
                <span className="font-medium text-accent-text">{t.goals.goalReached}</span>
              )}
            </div>
            {projection && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 font-medium ${STATUS_CHIP[projection.status]}`}>
                  {t.goals.projection.status[projection.status]}
                </span>
                <span className="text-foreground/80 font-medium">
                  {t.goals.projection.projected(projection.projectedYearKm)}
                </span>
                <span className="text-subtle">
                  {projection.status === 'ahead'
                    ? t.goals.projection.aheadBy(projection.deltaKm)
                    : projection.status === 'behind'
                      ? t.goals.projection.behindBy(projection.deltaKm)
                      : null}
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
            <Calendar size={14} className="text-accent-text" />
            {t.goals.monthlyGoal.title}
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {monthlyGoals.map((mg) => {
              const progress = mg.targetKm > 0 ? Math.min((mg.actualKm / mg.targetKm) * 100, 100) : 0
              const { Icon: StatusIcon, className: statusClassName } = MONTH_STATUS_ICON[mg.status]
              return (
                <GlassSurface key={mg.month} variant="card" className="rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-subtle">{monthLabel(mg.month)}</span>
                    <StatusIcon
                      size={11}
                      strokeWidth={3}
                      className={statusClassName}
                      aria-label={t.goals.monthlyGoal.status[mg.status]}
                    />
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-foreground">
                    {t.goals.monthlyGoal.km(Math.round(mg.actualKm), Math.round(mg.targetKm))}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${progress}%` }}
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
            <TrendingUp size={14} className="text-emerald-500 dark:text-emerald-400" />
            {t.goals.raceTargets}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {goals.targets.map((target) => {
              const pb = pbs.find((p) => p.entry.distance === target.distance)
              const pbSeconds = pb?.entry.seconds ?? null
              const delta = pbSeconds !== null && target.targetSeconds ? pbSeconds - target.targetSeconds : null
              const achieved = delta !== null && delta <= 0
              return (
                <GlassSurface key={target.distance} variant="card" className="rounded-2xl p-4">
                  <p className="text-xs font-semibold text-subtle">{target.distance}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {target.targetSeconds === null ? (
                      <span className="text-sm font-normal text-subtle">{t.goals.noTarget}</span>
                    ) : (
                      formatDuration(target.targetSeconds)
                    )}
                  </p>
                  {pbSeconds !== null && delta !== null && (
                    <p className={`mt-0.5 text-xs font-medium ${achieved ? 'text-accent-text' : 'text-orange-500 dark:text-orange-400'}`}>
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
            <Flag size={14} className="text-blue-500 dark:text-blue-400" />
            {t.goals.upcomingRaces}
          </h2>
          <div className="space-y-2">
            {upcomingRaces.map((race, idx) => {
              const daysUntil = Math.round(
                (new Date(race.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000
              )
              const isPast = race.date < today
              return (
                <GlassSurface key={idx} variant="card" className="flex items-start justify-between gap-3 rounded-2xl p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{race.name}</span>
                      <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium text-foreground/70">
                        {race.distance}
                      </span>
                      {race.targetSeconds && (
                        <span className="flex items-center gap-1 text-xs font-medium text-accent-text">
                          <Target size={11} />
                          {formatDuration(race.targetSeconds)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {formatDate(race.date)}
                      </span>
                      {race.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} />
                          {race.location}
                        </span>
                      )}
                      {race.url && (
                        <a
                          href={race.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-accent-text hover:underline"
                        >
                          <ExternalLink size={11} />
                          {t.goals.registrationLink}
                        </a>
                      )}
                    </div>
                  </div>
                  {!isPast && (
                    <span className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400">
                      {t.goals.daysUntil(daysUntil)}
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
            <Medal size={14} className="text-amber-500 dark:text-amber-400" />
            {t.goals.seasonRaces}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pbs.map(({ entry, activity, photoPath }) => {
              const tint = raceDistanceTint(entry.distance)
              return (
              <Link
                key={entry.activityId}
                href={`/activities/${entry.activityId}`}
                className="glass-card group relative overflow-hidden rounded-[20px] transition-shadow hover:shadow-lg"
              >
                {photoPath ? (
                  <div className="relative h-40 w-full overflow-hidden bg-muted">
                    <Image
                      src={photoPath}
                      alt={t.goals.raceAlt(entry.distance)}
                      fill
                      sizes="(min-width: 640px) 50vw, 100vw"
                      loading="eager"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent', tint.overlay)} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute bottom-3 left-4 text-2xl font-black text-white">
                      {entry.distance}
                    </span>
                  </div>
                ) : (
                  <div className="relative flex h-24 items-center justify-between overflow-hidden bg-accent-subtle px-5">
                    <div className={cn('absolute inset-0 bg-gradient-to-br to-transparent', tint.overlay)} />
                    <span className={cn('relative text-3xl font-black', tint.text)}>
                      {entry.distance}
                    </span>
                    <div className={cn('relative flex items-center gap-1.5 opacity-50', tint.text)}>
                      <ImageOff size={14} />
                      <span className="text-xs">{t.goals.noPhoto}</span>
                    </div>
                  </div>
                )}
                <div className="p-4">
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
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ActivityTypeTag type={activity.type} />
                    <span className="flex items-center gap-1 text-xs text-subtle">
                      <Calendar size={11} />
                      {formatDate(activity.date)}
                    </span>
                  </div>
                  {activity.description && (
                    <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      {activity.description}
                    </p>
                  )}
                </div>
              </Link>
              )
            })}
          </div>
        </section>
      ) : (
        <GlassSurface variant="card" className="rounded-[20px] border-dashed p-10 text-center">
          <Trophy size={32} className="mx-auto mb-3 text-subtle" />
          <p className="text-sm text-subtle">{t.goals.emptyPbs(yearData.year)}</p>
        </GlassSurface>
      )}
    </div>
  )
}
