'use client'

import Link from 'next/link'
import { Trophy, ArrowRight, Calendar } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { YearData } from '@/application/usecases/GetGoalsData'
import { formatDuration, formatDate, formatDelta, formatKm, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { MonthlyVolumeChart } from './MonthlyVolumeChart'
import { SeasonTimeline } from './SeasonTimeline'
import { raceDistanceTint } from '@/lib/colors'
import { PROJECTION_TONE } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const DIST_SHORT: Record<string, string> = { 'Half-Marathon': 'HM' }
export function shortDist(d: string) { return DIST_SHORT[d] ?? d }





interface Props {
  yearData: YearData
}

export function YearView({ yearData }: Props) {
  const { goals, pbs, upcomingRaces, totalDistanceKm, projection, monthlyGoals } = yearData

  const annualDistanceKm = goals?.annualDistanceKm ?? 0
  const annualProgress = annualDistanceKm > 0
    ? Math.min((totalDistanceKm / annualDistanceKm) * 100, 100)
    : 0
  // The projection is a mark on the bar the progress is already drawn on, not a
  // second picture of the same year: a line into a dashed line, unlabelled,
  // under a bar showing the same thing, said nothing twice.
  const projectedPercent = projection && annualDistanceKm > 0
    ? Math.min((projection.projectedYearKm / annualDistanceKm) * 100, 100)
    : null
  // deltaKm arrives absolute, so the sign has to be recomputed from the
  // projection itself. Reading it off `status` renders an on-track projection
  // that lands above the goal as "On track −30 km" - a minus on a surplus.
  const signedDeltaKm = projection ? projection.projectedYearKm - annualDistanceKm : 0
  const hasRaceDistanceCards = !!goals && (goals.targets.length > 0 || upcomingRaces.length > 0)

  return (
    <div className="space-y-8">
      {goals && (
        <section className="space-y-3">
          <GlassSurface variant="card" className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <SectionDivider as="h2">
                {t.goals.annualGoal}
              </SectionDivider>
              {projection && (
                <span className={cn('shrink-0 text-xs font-semibold', PROJECTION_TONE[projection.status])}>
                  {t.goals.projection.status[projection.status]}
                  {signedDeltaKm !== 0 && ` ${formatDelta(signedDeltaKm, t.units.km)}`}
                </span>
              )}
            </div>
            <div className="mb-3">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                <AnimatedValue value={totalDistanceKm} grouped />
              </span>
              <span className="ml-1 text-sm text-subtle">
                {'/ '}{formatKm(annualDistanceKm)}{' '}{t.units.km}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-foreground/[0.08]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${annualProgress}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--accent-text))',
                }}
              />
              {projectedPercent !== null && projection && (
                <span
                  role="img"
                  aria-label={t.goals.projection.projectionMarker(formatKm(projection.projectedYearKm))}
                  className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                  style={{ left: `${projectedPercent}%` }}
                />
              )}
            </div>
            {projection && (
              <p className="mt-2 text-caption text-subtle">
                <span className={cn('font-semibold', PROJECTION_TONE[projection.status])}>
                  {t.goals.projection.projectedBy(
                    formatKm(projection.projectedYearKm),
                    formatDate(`${yearData.year}-12-31`, { style: 'bare', year: 'never' }),
                  )}
                </span>
                {' · '}
                {t.goals.projection.rate(formatKm(projection.weeklyRate))}
                {' · '}
                {t.goals.projection.needsWeekly(formatKm(projection.weeklyNeeded))}
              </p>
            )}
          </GlassSurface>
        </section>
      )}

      {hasRaceDistanceCards && <SeasonTimeline yearData={yearData} />}

      {goals && monthlyGoals.length > 0 && (
        <MonthlyVolumeChart monthlyGoals={monthlyGoals} year={yearData.year} />
      )}

      {!hasRaceDistanceCards && (
        pbs.length > 0 ? (
          <section className="space-y-3">
            <SectionDivider as="h2">
              {t.goals.seasonRaces}
            </SectionDivider>
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
        )
      )}
    </div>
  )
}
