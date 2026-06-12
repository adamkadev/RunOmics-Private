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
    <div className="space-y-10">
      {goals && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Target size={14} className="text-emerald-500" />
            Annual Goal
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {totalDistanceKm.toFixed(0)}
                </span>
                <span className="ml-1 text-sm text-gray-400">/ {goals.annualDistanceKm} km</span>
              </div>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {annualProgress.toFixed(0)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${annualProgress}%` }}
              />
            </div>
            {remaining > 0 && (
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {remaining.toFixed(0)} km remaining
              </p>
            )}
          </div>
        </section>
      )}

      {goals && goals.targets.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <TrendingUp size={14} className="text-orange-500" />
            Race Targets
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {goals.targets.map((t) => {
              const pb = pbs.find((p) => p.entry.distance === t.distance)
              const pbSeconds = pb?.activity.durationSeconds ?? null
              const delta = pbSeconds !== null && t.targetSeconds ? pbSeconds - t.targetSeconds : null
              const achieved = delta !== null && delta <= 0
              return (
                <div
                  key={t.distance}
                  className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">{t.distance}</p>
                  <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                    {t.targetSeconds === null ? (
                      <span className="text-sm font-normal text-gray-400 dark:text-gray-500">No target</span>
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
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Trophy size={14} className="text-amber-500" />
            Personal Bests
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pbs.map(({ entry, activity, photoPath }) => (
              <Link
                key={entry.activityId}
                href={`/activities/${entry.activityId}`}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                {photoPath ? (
                  <div className="relative h-40 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
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
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatDuration(activity.durationSeconds)}
                      </p>
                      {activity.paceSecPerKm && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatPace(activity.paceSecPerKm)}
                        </p>
                      )}
                    </div>
                    <ArrowRight size={16} className="mt-1 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ActivityTypeTag type={activity.type} />
                    <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                      <Calendar size={11} />
                      {formatDate(activity.date)}
                    </span>
                  </div>
                  {activity.description && (
                    <p className="mt-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {activity.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center dark:border-gray-800">
          <Trophy size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Add PBs for {yearData.year} to{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">
              public/pbs.json
            </code>
          </p>
        </div>
      )}
    </div>
  )
}
