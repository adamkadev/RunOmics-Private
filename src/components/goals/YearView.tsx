import Image from 'next/image'
import Link from 'next/link'
import { Trophy, Target, TrendingUp, ArrowRight, Calendar } from 'lucide-react'
import type { YearData } from '@/application/usecases/GetGoalsData'
import { formatDuration, formatDate, formatPace } from '@/lib/formatters'
import { ActivityTypeTag } from '@/components/activities/ActivityTypeTag'

export function YearView({ yearData }: { yearData: YearData }) {
  const { goals, pbs, totalDistanceKm } = yearData

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
            Annual Goal
          </h2>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  {totalDistanceKm.toFixed(0)}
                </span>
                <span className="ml-1 text-sm text-subtle">/ {goals.annualDistanceKm} km</span>
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
            {remaining > 0 && (
              <p className="mt-2 text-xs text-subtle">
                {remaining.toFixed(0)} km remaining
              </p>
            )}
          </div>
        </section>
      )}

      {goals && goals.targets.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp size={14} className="text-orange-500 dark:text-orange-400" />
            Race Targets
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {goals.targets.map((t) => {
              const pb = pbs.find((p) => p.entry.distance === t.distance)
              const pbSeconds = pb?.entry.seconds ?? null
              const delta = pbSeconds !== null && t.targetSeconds ? pbSeconds - t.targetSeconds : null
              const achieved = delta !== null && delta <= 0
              return (
                <div
                  key={t.distance}
                  className="rounded-xl border border-border bg-card p-4 shadow-card"
                >
                  <p className="text-xs font-semibold text-subtle">{t.distance}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {t.targetSeconds === null ? (
                      <span className="text-sm font-normal text-subtle">No target</span>
                    ) : (
                      formatDuration(t.targetSeconds)
                    )}
                  </p>
                  {pbSeconds !== null && delta !== null && (
                    <p className={`mt-0.5 text-xs font-medium ${achieved ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}>
                      {achieved
                        ? `✓ Done (${formatDuration(Math.abs(delta))} ahead)`
                        : `${formatDuration(delta)} to go`}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {pbs.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Trophy size={14} className="text-amber-500 dark:text-amber-400" />
            Personal Bests
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pbs.map(({ entry, activity, photoPath }) => (
              <Link
                key={entry.activityId}
                href={`/activities/${entry.activityId}`}
                className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow hover:shadow-lg"
              >
                {photoPath ? (
                  <div className="relative h-40 w-full overflow-hidden bg-muted">
                    <Image
                      src={photoPath}
                      alt={`${entry.distance} race`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute bottom-3 left-4 text-2xl font-black text-white">
                      {entry.distance}
                    </span>
                  </div>
                ) : (
                  <div className="flex h-24 items-center bg-gradient-to-br from-emerald-50 to-emerald-100 px-5 dark:from-emerald-900/20 dark:to-emerald-800/10">
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                      {entry.distance}
                    </span>
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
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Trophy size={32} className="mx-auto mb-3 text-subtle" />
          <p className="text-sm text-subtle">
            Add PBs for {yearData.year} to{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              public/pbs.json
            </code>
          </p>
        </div>
      )}
    </div>
  )
}
