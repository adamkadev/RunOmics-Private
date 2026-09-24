'use client'

import Link from 'next/link'
import { Trophy, ArrowRight, Calendar } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { YearData } from '@/application/usecases/GetGoalsData'
import { formatDuration, formatDate, formatKm, formatPace } from '@/lib/formatters'
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
  today: string
}

export function YearView({ yearData, today }: Props) {
  const { goals, pbs, upcomingRaces, totalDistanceKm, projection, monthlyGoals } = yearData

  const annualDistanceKm = goals?.annualDistanceKm ?? 0
  const annualProgress = annualDistanceKm > 0
    ? Math.min((totalDistanceKm / annualDistanceKm) * 100, 100)
    : 0
  const projectedPercent = projection && annualDistanceKm > 0
    ? Math.min((projection.projectedYearKm / annualDistanceKm) * 100, 100)
    : null
  // Colour encodes state, weight encodes certainty - amber is reserved for the
  // verdict (the projection line and the next-race countdown) and appears
  // nowhere else. This bar states how far training has come, not a grade, so
  // it stays this fixed blue regardless of projection status or accent theme.
  const BAR_COLOR = '#5a97f5'
  // deltaKm arrives absolute, so the sign has to be recomputed from the
  // projection itself. Reading it off `status` renders an on-track projection
  // that lands above the goal as "On track −30 km" - a minus on a surplus.
  const signedDeltaKm = projection ? projection.projectedYearKm - annualDistanceKm : 0
  const outcome = projection && signedDeltaKm !== 0
    ? signedDeltaKm < 0
      ? t.goals.projection.shortBy(formatKm(Math.abs(signedDeltaKm)))
      : t.goals.projection.overBy(formatKm(signedDeltaKm))
    : null
  const hasRaceDistanceCards = !!goals && (goals.targets.length > 0 || upcomingRaces.length > 0)

  return (
    <div className="space-y-8">
      {goals && (
        <section className="space-y-3">
          <GlassSurface variant="card" className="p-5">
            <SectionDivider as="h2" className="mb-3">
              {t.goals.annualGoal}
            </SectionDivider>
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
                style={{ width: `${annualProgress}%`, background: BAR_COLOR }}
              />
              {projectedPercent !== null && projection && (
                <>
                  <span
                    role="img"
                    aria-label={t.goals.projection.projected(formatKm(projection.projectedYearKm))}
                    className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${projectedPercent}%`, background: 'var(--foreground)' }}
                  />
                  <span
                    aria-hidden
                    className="absolute top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[9.5px] leading-none"
                    style={{ left: `${projectedPercent}%`, color: 'var(--subtle-2)' }}
                  >
                    {t.goals.projection.projectedTick}
                  </span>
                </>
              )}
            </div>
            {projection && (
              <>
                {/* The projection is the answer this card exists to give, so it is
                    the headline under the bar, not a small top-right chip - the
                    same shortfall no longer reads as two different severities. */}
                <p className={cn('mt-2 text-[17px] font-bold', PROJECTION_TONE[projection.status])}>
                  {t.goals.projection.projected(formatKm(projection.projectedYearKm))}
                  {outcome && ` · ${outcome}`}
                </p>
                <p className="mt-0.5 text-caption text-subtle">
                  {t.goals.projection.needsWeeklyDetail(
                    formatKm(projection.weeklyNeeded),
                    formatKm(projection.weeklyRate),
                  )}
                </p>
              </>
            )}
          </GlassSurface>
        </section>
      )}

      {hasRaceDistanceCards && <SeasonTimeline yearData={yearData} today={today} />}

      {goals && monthlyGoals.length > 0 && (
        <MonthlyVolumeChart monthlyGoals={monthlyGoals} year={yearData.year} today={today} />
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
