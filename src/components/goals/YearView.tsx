'use client'

import Link from 'next/link'
import { Trophy, ArrowRight, Calendar } from 'lucide-react'
import type { YearData, GoalProjection } from '@/application/usecases/GetGoalsData'
import { formatDuration, formatDate, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { MonthlyVolumeChart } from './MonthlyVolumeChart'
import { SeasonTimeline } from './SeasonTimeline'
import { raceDistanceTint } from '@/lib/colors'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const DIST_SHORT: Record<string, string> = { 'Half-Marathon': 'HM' }
export function shortDist(d: string) { return DIST_SHORT[d] ?? d }

// Text-only status indicator for the annual-goal header (no chip background,
// no icon): green ahead, blue on track, amber behind.
const PROJECTION_STATUS_CLASS: Record<GoalProjection['status'], string> = {
  ahead:    STATUS.success.text,
  on_track: STATUS.progress.text,
  behind:   STATUS.warning.text,
}

// Two-segment trend line for the annual-goal hero: solid from Jan 1 to today's
// actual progress, dashed from today to the year-end projection. Purely
// presentational - the underlying numbers all come from computeProjection.
// Runs edge-to-edge (x: 0-300) so the card's full width is used.
function projectionSparkline(year: number, annualDistanceKm: number, annualProgress: number, projection: GoalProjection) {
  const yearStart = new Date(year, 0, 1).getTime()
  const yearEnd = new Date(year + 1, 0, 1).getTime()
  const elapsedFraction = Math.min(Math.max((Date.now() - yearStart) / (yearEnd - yearStart), 0), 1)
  const projectedPercent = (projection.projectedYearKm / annualDistanceKm) * 100
  const domainMax = Math.max(100, projectedPercent) * 1.08
  const yFor = (pct: number) => 40 - (Math.min(Math.max(pct, 0), domainMax) / domainMax) * 34
  return { nowX: elapsedFraction * 300, nowY: yFor(annualProgress), endY: yFor(projectedPercent) }
}

interface Props {
  yearData: YearData
}

export function YearView({ yearData }: Props) {
  const { goals, pbs, upcomingRaces, totalDistanceKm, projection, monthlyGoals } = yearData

  const annualDistanceKm = goals?.annualDistanceKm ?? 0
  const annualProgress = annualDistanceKm > 0
    ? Math.min((totalDistanceKm / annualDistanceKm) * 100, 100)
    : 0
  const sparkline = projection && annualDistanceKm > 0
    ? projectionSparkline(yearData.year, annualDistanceKm, annualProgress, projection)
    : null
  const hasRaceDistanceCards = !!goals && (goals.targets.length > 0 || upcomingRaces.length > 0)

  return (
    <div className="space-y-8">
      {goals && (
        <section className="space-y-3">
          <GlassSurface variant="card" className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t.goals.annualGoal}
              </h2>
              {projection && (
                <span className={cn('shrink-0 text-xs font-semibold', PROJECTION_STATUS_CLASS[projection.status])}>
                  {t.goals.projection.status[projection.status]}
                  {projection.deltaKm !== 0 && ` ${projection.status === 'ahead' ? '+' : '-'}${Math.abs(projection.deltaKm)} km`}
                </span>
              )}
            </div>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  <AnimatedValue value={totalDistanceKm} />
                </span>
                <span className="ml-1 text-sm text-subtle">
                  {'/ '}{annualDistanceKm}{' '}{t.units.km}
                </span>
              </div>
              <span className="text-sm font-semibold text-accent-text">
                <AnimatedValue value={annualProgress} />%
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
            {sparkline && projection && (
              <>
                <svg viewBox="0 0 300 44" preserveAspectRatio="none" className="mt-3 h-9 w-full">
                  <path
                    d={`M0 40 L${sparkline.nowX.toFixed(1)} ${sparkline.nowY.toFixed(1)}`}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                  <path
                    d={`M${sparkline.nowX.toFixed(1)} ${sparkline.nowY.toFixed(1)} L300 ${sparkline.endY.toFixed(1)}`}
                    fill="none"
                    className="text-subtle"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                </svg>
                <p className="mt-1 text-caption text-subtle">
                  {t.goals.projection.rate(projection.weeklyRate)} - {t.goals.projection.projected(projection.projectedYearKm)}
                </p>
              </>
            )}
          </GlassSurface>
        </section>
      )}

      {hasRaceDistanceCards && <SeasonTimeline yearData={yearData} />}

      {goals && monthlyGoals.length > 0 && <MonthlyVolumeChart monthlyGoals={monthlyGoals} />}

      {!hasRaceDistanceCards && (
        pbs.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
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
        )
      )}
    </div>
  )
}
