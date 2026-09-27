'use client'

import Link from 'next/link'
import { Trophy, ArrowRight, Calendar } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { YearData } from '@/application/usecases/GetGoalsData'
import { formatDuration, formatDate, formatKm, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill } from '@/components/ui/StatusPill'
import { MonthlyVolumeChart } from './MonthlyVolumeChart'
import { SeasonTimeline, type SeasonBlock } from './SeasonTimeline'
import { shortDist } from './shortDistance'
import { PROJECTION_TONE } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'


interface Props {
  yearData: YearData
  today: string
  /** The training block the next race closes, for the season strip. */
  block?: SeasonBlock | null
}

export function YearView({ yearData, today, block = null }: Props) {
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
  // nowhere else. This bar states how far training has come, not a grade: a
  // progress fill, which is the accent's job. It was a fixed blue that was
  // neither the accent nor a status colour.
  const BAR_COLOR = 'var(--accent)'
  // deltaKm arrives absolute, so the sign has to be recomputed from the
  // projection itself. Reading it off `status` renders an on-track projection
  // that lands above the goal as "On track −30 km" - a minus on a surplus.
  const signedDeltaKm = projection ? projection.projectedYearKm - annualDistanceKm : 0
  const outcome = projection && signedDeltaKm !== 0
    ? signedDeltaKm < 0
      ? t.goals.projection.shortBy(formatKm(Math.abs(signedDeltaKm)))
      : t.goals.projection.overBy(formatKm(signedDeltaKm))
    : null
  // Reached is a state the card says outright, with the surplus, rather than a
  // full bar the reader has to decode.
  const reachedByKm = annualDistanceKm > 0 && totalDistanceKm >= annualDistanceKm ? Math.round(totalDistanceKm - annualDistanceKm) : null
  const hasRaceDistanceCards = !!goals && (goals.targets.length > 0 || upcomingRaces.length > 0)

  return (
    <div className="space-y-8">
      {goals && (
        <section className="space-y-3">
          <GlassSurface variant="card" className="p-5">
            <SectionDivider as="h2" className="mb-3">
              {t.goals.volumeGoal(yearData.year)}
            </SectionDivider>
            <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {/* No count-up (v5.6 #1): a frame mid-way read 1,040 of a 1,116 year, beside "+116 km". */}
                {formatKm(totalDistanceKm)}
              </span>
              <span className="text-sm text-subtle">{t.goals.ofKm(formatKm(annualDistanceKm))}</span>
              {reachedByKm !== null && (
                <StatusPill tone="good" className="font-semibold">{t.goals.reached(formatKm(reachedByKm))}</StatusPill>
              )}
            </div>
            <div className="relative h-2 rounded-full bg-foreground/[0.08]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${annualProgress}%`, background: BAR_COLOR }}
              />
              {projectedPercent !== null && projection && (
                <>
                  {/* The tick alone: the sentence under the bar names it (C3). */}
                  <span
                    role="img"
                    aria-label={t.goals.projection.projected(formatKm(projection.projectedYearKm))}
                    className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${projectedPercent}%`, background: 'var(--foreground)' }}
                  />
                </>
              )}
            </div>
            {projection && (
              // The verdict is only its short first sentence, in its tone;
              // what the goal needs follows in muted ink (C3, v4.4).
              <p className="mt-2 text-body leading-snug" data-testid="projection-line">
                <span className={cn('font-bold', PROJECTION_TONE[projection.status])} data-testid="projection-verdict">
                  {t.goals.projection.verdict(t.goals.projection.projected(formatKm(projection.projectedYearKm)), outcome)}
                </span>{' '}
                <span className="text-muted-foreground">
                  {t.goals.projection.needsWeeklyDetail(
                    formatKm(projection.weeklyNeeded),
                    formatKm(projection.weeklyRate),
                  )}
                </span>
              </p>
            )}
          </GlassSurface>
        </section>
      )}

      {hasRaceDistanceCards && <SeasonTimeline yearData={yearData} today={today} block={block} />}

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
                return (
                  <Link
                    key={entry.activityId}
                    href={`/activities/${entry.activityId}`}
                    className="glass-card group relative overflow-hidden rounded-card-sm transition-shadow hover:shadow-lg"
                  >
                    <div className="flex h-24 items-center border-b border-border px-5">
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
