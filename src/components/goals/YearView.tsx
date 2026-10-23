'use client'

import Link from 'next/link'
import { Trophy, ArrowRight, Calendar } from 'lucide-react'
import { EYEBROW_CLASS, SectionDivider } from '@/components/ui/SectionLabel'
import { cardClass } from '@/components/ui/Card'
import type { YearData } from '@/application/usecases/GetGoalsData'
import { formatDuration, formatDate, formatKm, formatPace } from '@/lib/formatters'
import { Unit } from '@/components/ui/Stat'
import { MonthlyVolumeChart } from './MonthlyVolumeChart'
import { SeasonTimeline, type SeasonBlock } from './SeasonTimeline'
import { shortDist } from './shortDistance'
import { t } from '@/i18n'
import { OutcomePill } from './OutcomePill'
import { cn } from '@/lib/utils'

const TITLE = 'text-[15px] font-semibold text-foreground'

interface Props {
  yearData: YearData
  today: string
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
  // deltaKm arrives absolute and `status` can be on track above the goal, so the sign comes from the projection.
  const signedDeltaKm = projection ? projection.projectedYearKm - annualDistanceKm : 0
  const projectionColor = signedDeltaKm < 0 ? 'var(--warn)' : 'var(--pos)'
  const verdict = signedDeltaKm < 0
    ? p.shortAtPace(formatKm(Math.abs(signedDeltaKm)))
    : signedDeltaKm > 0
      ? p.overAtPace(formatKm(signedDeltaKm))
      : p.onPace
  const reachedByKm = annualDistanceKm > 0 && totalDistanceKm >= annualDistanceKm ? Math.round(totalDistanceKm - annualDistanceKm) : null
  const hasRaceDistanceCards = (goals?.targets.length ?? 0) > 0 || upcomingRaces.length > 0
  // A year not yet started has nothing to show against its goal.
  const notStarted = yearData.year > Number(today.slice(0, 4)) && totalDistanceKm === 0
  const leftKm = annualDistanceKm > 0 && reachedByKm === null ? Math.round(annualDistanceKm - totalDistanceKm) : null
  const yearOver = yearData.year < Number(today.slice(0, 4))
  const leftLine = leftKm === null ? null : yearOver ? p.finalShort(formatKm(leftKm)) : p.toGo(formatKm(leftKm))

  return (
    <div className="flex flex-col gap-3.5">
      {goals && !notStarted && (
        <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="goal-card">
          <h2 className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{t.goals.distanceGoal}</h2>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[38px] font-bold leading-none tracking-[-0.03em] text-foreground">
              {/* No count-up: a frame mid-way would read 1,040 of a 1,116 year beside "+116 km". */}
              {formatKm(totalDistanceKm)}
            </span>
            <span className="text-[15px] text-[var(--text-2)]">{t.goals.ofKm(formatKm(annualDistanceKm))}</span>
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
          {(leftLine || projection) && (
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span data-testid="goal-left">{leftLine}</span>
              {projection && <span style={{ color: projectionColor }}>{p.projectedMark(formatKm(projection.projectedYearKm))}</span>}
            </div>
          )}
          {projection && (
            <p className="border-t border-border pt-2.5 text-[13px] leading-normal text-[var(--text-2)] text-pretty" data-testid="projection-line">
              <b className="font-semibold" style={{ color: projectionColor }} data-testid="projection-verdict">{verdict}</b>{' '}
              {(signedDeltaKm < 0 ? p.closes : p.needs)(formatKm(projection.weeklyNeeded), formatKm(projection.weeklyRate))}
            </p>
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
