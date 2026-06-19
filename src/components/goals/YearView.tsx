import Image from 'next/image'
import Link from 'next/link'
import { Trophy, Target, Medal, TrendingUp, ArrowRight, Calendar, ImageOff} from 'lucide-react'
import type { YearData, GoalProjection } from '@/application/usecases/GetGoalsData'
import { formatDuration, formatDate, formatPace } from '@/lib/formatters'
import { ActivityTypeTag } from '@/components/activities/ActivityTypeTag'
import { Card, cardClass } from '@/components/ui/Card'
import { t } from '@/i18n'

const STATUS_CHIP: Record<GoalProjection['status'], string> = {
  ahead:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  on_track: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  behind:   'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

export function YearView({ yearData }: { yearData: YearData }) {
  const { goals, pbs, totalDistanceKm, projection } = yearData

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
            <Target size={14} className="text-emerald-500 dark:text-emerald-400" />
            {t.goals.annualGoal}
          </h2>
          <Card accent="emerald" padding="lg">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  {totalDistanceKm.toFixed(0)}
                </span>
                <span className="ml-1 text-sm text-subtle">/ {goals.annualDistanceKm} {t.units.km}</span>
              </div>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {annualProgress.toFixed(0)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${annualProgress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              {remaining > 0 ? (
                <span className="text-subtle">{t.goals.kmRemaining(Number(remaining.toFixed(0)))}</span>
              ) : (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{t.goals.goalReached}</span>
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
          </Card>
        </section>
      )}

      {goals && goals.targets.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp size={14} className="text-orange-500 dark:text-orange-400" />
            {t.goals.raceTargets}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {goals.targets.map((target) => {
              const pb = pbs.find((p) => p.entry.distance === target.distance)
              const pbSeconds = pb?.entry.seconds ?? null
              const delta = pbSeconds !== null && target.targetSeconds ? pbSeconds - target.targetSeconds : null
              const achieved = delta !== null && delta <= 0
              return (
                <Card key={target.distance} accent="orange">
                  <p className="text-xs font-semibold text-subtle">{target.distance}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {target.targetSeconds === null ? (
                      <span className="text-sm font-normal text-subtle">{t.goals.noTarget}</span>
                    ) : (
                      formatDuration(target.targetSeconds)
                    )}
                  </p>
                  {pbSeconds !== null && delta !== null && (
                    <p className={`mt-0.5 text-xs font-medium ${achieved ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}>
                      {achieved
                        ? t.goals.targetDone(formatDuration(Math.abs(delta)))
                        : t.goals.targetToGo(formatDuration(delta))}
                    </p>
                  )}
                </Card>
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
            {pbs.map(({ entry, activity, photoPath }) => (
              <Link
                key={entry.activityId}
                href={`/activities/${entry.activityId}`}
                className={cardClass({ accent: 'violet', padding: 'none', overflow: true, className: 'group relative transition-shadow hover:shadow-lg' })}
              >
                {photoPath ? (
                  <div className="relative h-40 w-full overflow-hidden bg-muted">
                    <Image
                      src={photoPath}
                      alt={t.goals.raceAlt(entry.distance)}
                      fill
                      loading="eager"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute bottom-3 left-4 text-2xl font-black text-white">
                      {entry.distance}
                    </span>
                  </div>
                ) : (
                  <div className="flex h-24 items-center justify-between bg-gradient-to-br from-emerald-50 to-emerald-100 px-5 dark:from-emerald-900/20 dark:to-emerald-800/10">
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                      {entry.distance}
                    </span>
                    <div className="flex items-center gap-1.5 text-emerald-400/60 dark:text-emerald-600/60">
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
            ))}
          </div>
        </section>
      ) : (
        <Card dashed accent="violet" padding="none" className="p-10 text-center">
          <Trophy size={32} className="mx-auto mb-3 text-subtle" />
          <p className="text-sm text-subtle">{t.goals.emptyPbs(yearData.year)}</p>
          <Link href="/settings" className="mt-2 inline-block text-xs text-emerald-600 hover:underline dark:text-emerald-400">
            {t.nav.items.settings}
          </Link>
        </Card>
      )}
    </div>
  )
}
