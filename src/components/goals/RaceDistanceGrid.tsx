'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { GoalTarget, YearData } from '@/application/usecases/GetGoalsData'
import { DISTANCE_KEY } from '@/domain/activity/effort'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDayMonth, formatDuration } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { shortDist } from './YearView'

// Drops the countdown ("· D-77") when the full line would overflow its box,
// keeping the race name and date intact rather than letting CSS ellipsis eat
// into the name - measured against the real rendered width, not a guessed
// character count, since that guess was wrong on narrow cards.
function RaceLine({ full, short, className }: { full: string | null; short: string; className: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !full) return
    setCollapsed(el.scrollWidth > el.clientWidth)
  }, [full, short])

  return (
    <p ref={ref} className={cn('truncate', className)}>
      {collapsed ? short : (full ?? short)}
    </p>
  )
}

export function RaceDistanceGrid({ yearData }: { yearData: YearData }) {
  const { goals, pbs, upcomingRaces, nextRaceSpotlight, predictions } = yearData
  const s = t.goals
  if (!goals) return null
  const targetDistances = new Set(goals.targets.map((target) => target.distance))
  const extraDistances = [...new Set(upcomingRaces.map((race) => race.distance))].filter(
    (distance) => !targetDistances.has(distance)
  )
  const allTargets: GoalTarget[] = [
    ...goals.targets,
    ...extraDistances.map((distance) => ({ distance, targetSeconds: null })),
  ]
  if (allTargets.length === 0) return null

  const today = new Date().toISOString().slice(0, 10)

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{s.raceDistances}</h2>
      <div className="grid grid-cols-2 gap-3">
        {allTargets.map((target) => {
          const pb = pbs.find((p) => p.entry.distance === target.distance)
          const isSpotlight = nextRaceSpotlight?.race.distance === target.distance
          const otherRace = upcomingRaces.find((r) => r.distance === target.distance && r !== nextRaceSpotlight?.race)
          const scheduledRace = isSpotlight ? nextRaceSpotlight!.race : otherRace ?? null
          const achieved = !!pb && target.targetSeconds !== null && pb.entry.seconds <= target.targetSeconds
          const rawPredicted = predictions.find((p) => p.key === DISTANCE_KEY[target.distance])?.predictedSeconds ?? null

          // Every scheduled race gets the same "never predict slower than a
          // proven PR" treatment as the NEXT RACE hero - not just the closest one.
          const predictedSeconds = isSpotlight
            ? nextRaceSpotlight!.predictedSeconds
            : rawPredicted !== null && pb
              ? Math.min(rawPredicted, pb.entry.seconds)
              : rawPredicted

          const daysUntil = isSpotlight
            ? nextRaceSpotlight!.daysUntil
            : otherRace
              ? Math.round((new Date(otherRace.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000)
              : null

          const raceLineShort = scheduledRace ? `${scheduledRace.name} · ${formatDayMonth(scheduledRace.date)}` : null
          const raceLineFull = raceLineShort && daysUntil !== null ? `${raceLineShort} · ${t.nextRace.countdown(daysUntil)}` : null

          return (
            <GlassSurface
              key={target.distance}
              variant="card"
              className={cn('rounded-card-sm p-4', !pb && 'border-dashed')}
              style={achieved ? { background: 'rgba(30,215,135,0.18)', borderColor: 'rgba(30,215,135,0.4)' } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{shortDist(target.distance)}</span>
                <span className="shrink-0 text-xs text-subtle">
                  {target.targetSeconds !== null ? `${s.target} ${formatDuration(target.targetSeconds)}` : s.noTarget}
                </span>
              </div>

              {scheduledRace ? (
                <>
                  <p className="mt-1.5 flex items-baseline gap-1.5 text-xl font-bold text-accent-text">
                    {predictedSeconds !== null ? formatDuration(predictedSeconds) : '-'}
                    <span className="text-xs font-normal text-subtle">{s.predictedTag}</span>
                  </p>
                  {raceLineShort && (
                    <RaceLine full={raceLineFull} short={raceLineShort} className="mt-0.5 text-xs text-orange-400" />
                  )}
                </>
              ) : pb ? (
                <>
                  <p className={cn('mt-1.5 flex items-center gap-1.5 text-xl font-bold', achieved ? STATUS.success.text : 'text-foreground')}>
                    {formatDuration(pb.entry.seconds)}
                    {achieved && <Check size={15} strokeWidth={3} />}
                    {!achieved && target.targetSeconds !== null && (
                      <span className="text-sm font-semibold text-accent-text">
                        +{formatDuration(pb.entry.seconds - target.targetSeconds)}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-subtle">
                    {achieved
                      ? formatDayMonth(pb.activity.date) + (pb.activity.description ? ` · ${pb.activity.description}` : '')
                      : `${s.best} · ${formatDayMonth(pb.activity.date)}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-sm font-medium text-subtle">
                    {target.targetSeconds === null ? s.noTargetSet : s.noTarget}
                  </p>
                  {rawPredicted !== null && (
                    <p className="mt-0.5 text-xs text-subtle">
                      {t.records.predictedFromFitness(formatDuration(rawPredicted))}{' '}
                      <span className="text-accent-text">{s.findRace}</span>
                    </p>
                  )}
                </>
              )}
            </GlassSurface>
          )
        })}
      </div>
    </section>
  )
}
