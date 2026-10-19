'use client'

import Link from 'next/link'
import { Trophy, ArrowRight, Calendar } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { cardClass } from '@/components/ui/Card'
import type { YearData } from '@/application/usecases/GetGoalsData'
import { formatDuration, formatDate, formatKm, formatPace } from '@/lib/formatters'
import { Unit } from '@/components/ui/Stat'
import { MonthlyVolumeChart } from './MonthlyVolumeChart'
import { SeasonTimeline, type SeasonBlock } from './SeasonTimeline'
import { shortDist } from './shortDistance'
import { t } from '@/i18n'
import { OutcomePill } from './OutcomePill'

const TITLE = 'text-[15px] font-semibold text-foreground'

interface Props {
  yearData: YearData
  today: string
  /** The training block the next race closes, for the season strip. */
  block?: SeasonBlock | null
}

export function YearView({ yearData, today, block = null }: Props) {
  const { goals, pbs, upcomingRaces, totalDistanceKm, projection, monthlyGoals } = yearData
  const p = t.goals.projection

  const annualDistanceKm = goals?.annualDistanceKm ?? 0
  const annualProgress = annualDistanceKm > 0
    ? Math.min((totalDistanceKm / annualDistanceKm) * 100, 100)
    : 0
  const projectedPercent = projection && annualDistanceKm > 0
    ? Math.min((projection.projectedYearKm / annualDistanceKm) * 100, 100)
    : null
  // deltaKm arrives absolute, so the sign has to be recomputed from the
  // projection itself. Reading it off `status` renders an on-track projection
  // that lands above the goal as "On track −30 km" - a minus on a surplus.
  const signedDeltaKm = projection ? projection.projectedYearKm - annualDistanceKm : 0
  // The year's km is the athlete's own data, so the fill is the accent
  // (v4.17); the projection is the verdict, warn when it falls short.
  const projectionColor = signedDeltaKm < 0 ? 'var(--warn)' : 'var(--pos)'
  const verdict = signedDeltaKm < 0
    ? p.shortAtPace(formatKm(Math.abs(signedDeltaKm)))
    : signedDeltaKm > 0
      ? p.overAtPace(formatKm(signedDeltaKm))
      : p.onPace
  // Reached is a state the card says outright, with the surplus, rather than a
  // full bar the reader has to decode.
  const reachedByKm = annualDistanceKm > 0 && totalDistanceKm >= annualDistanceKm ? Math.round(totalDistanceKm - annualDistanceKm) : null
  const hasRaceDistanceCards = !!goals && (goals.targets.length > 0 || upcomingRaces.length > 0)
  // A year not yet started has nothing to show against its goal (3.0): "0 of 2,500 km" was an empty state.
  const notStarted = yearData.year > Number(today.slice(0, 4)) && totalDistanceKm === 0

  return (
    <div className="flex flex-col gap-3.5">
      {goals && !notStarted && (
        <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="goal-card">
          <h2 className={TITLE}>{t.goals.distanceGoal}</h2>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-foreground">
              {/* No count-up (v5.6 #1): a frame mid-way read 1,040 of a 1,116 year, beside "+116 km". */}
              {formatKm(totalDistanceKm)}
            </span>
            <span className="text-sm text-muted-foreground">{t.goals.ofKm(formatKm(annualDistanceKm))}</span>
            {reachedByKm !== null && <OutcomePill tone="pos" className="self-center">{t.goals.reached(formatKm(reachedByKm))}</OutcomePill>}
          </p>
          <div className="relative h-2 rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full bg-accent" data-testid="goal-fill" style={{ width: `${annualProgress}%` }} />
            {projectedPercent !== null && projection && (
              <span
                role="img"
                aria-label={p.projected(formatKm(projection.projectedYearKm))}
                data-testid="goal-projection"
                className="absolute -bottom-[5px] -top-[5px] w-0.5 -translate-x-1/2 rounded-full"
                style={{ left: `${projectedPercent}%`, background: projectionColor }}
              />
            )}
          </div>
          {projection && (
            <>
              <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                <span>{p.today}</span>
                <span style={{ color: projectionColor }}>{p.projectedMark(formatKm(projection.projectedYearKm))}</span>
              </div>
              {/* The verdict in its tone, then what the goal needs (C3, v4.17). */}
              <p className="border-t border-border pt-2.5 text-sm leading-normal text-[var(--text-2)]" data-testid="projection-line">
                <b className="font-semibold" style={{ color: projectionColor }} data-testid="projection-verdict">{verdict}</b>{' '}
                {p.needs(formatKm(projection.weeklyNeeded), formatKm(projection.weeklyRate))}
              </p>
            </>
          )}
        </section>
      )}

      {hasRaceDistanceCards && <SeasonTimeline yearData={yearData} today={today} block={block} />}

      {goals && !notStarted && monthlyGoals.length > 0 && (
        <MonthlyVolumeChart monthlyGoals={monthlyGoals} year={yearData.year} today={today} />
      )}

      {!hasRaceDistanceCards && (
        pbs.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <SectionDivider as="h2" className="px-1">
              {t.goals.seasonRaces}
            </SectionDivider>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {pbs.map(({ entry, activity }) => {
                return (
                  <Link
                    key={entry.activityId}
                    href={`/activities/${entry.activityId}`}
                    className={cardClass({ className: 'group flex flex-col gap-1.5 transition-colors hover:border-[var(--line-2)]' })}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={TITLE}>{shortDist(entry.distance)}</span>
                      <ArrowRight size={16} className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </div>
                    <p className="text-[26px] font-semibold leading-tight text-foreground">
                      {formatDuration(entry.seconds)}
                      {activity.paceSecPerKm && <Unit>{formatPace(activity.paceSecPerKm)}</Unit>}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar size={12} className="shrink-0" aria-hidden />
                      <span>{formatDate(activity.date)}</span>
                      {activity.description && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{activity.description}</span>
                        </>
                      )}
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : (
          <section className={cardClass({ dashed: true, className: 'p-10 text-center' })}>
            <Trophy size={24} className="mx-auto mb-3 text-subtle" aria-hidden />
            <p className="text-sm text-subtle">{t.goals.emptyPbs(yearData.year)}</p>
          </section>
        )
      )}
    </div>
  )
}
