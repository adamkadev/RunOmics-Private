import { Check } from 'lucide-react'
import type { YearData } from '@/application/usecases/GetGoalsData'
import { DISTANCE_KEY } from '@/domain/activity/effort'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatCompactDate, formatDate, formatDuration } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { shortDist } from './YearView'

function gapDisplay(gapSeconds: number): { label: string; className: string } {
  if (gapSeconds <= 0) return { label: `-${formatDuration(Math.abs(gapSeconds))}`, className: STATUS.success.text }
  return { label: `+${formatDuration(gapSeconds)}`, className: STATUS.warning.text }
}

// One card per race distance the athlete has a goal for - target, result (or
// prediction) and race context live in the same place instead of being split
// across a pill row, a "next race" hero and a season-races grid that all
// restated the same fact once a target was hit.
export function RaceDistanceGrid({ yearData }: { yearData: YearData }) {
  const { goals, pbs, upcomingRaces, nextRaceSpotlight, predictions } = yearData
  const s = t.goals
  if (!goals || goals.targets.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{s.raceDistances}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {goals.targets.map((target) => {
          const pb = pbs.find((p) => p.entry.distance === target.distance)
          const isSpotlight = nextRaceSpotlight?.race.distance === target.distance
          const otherRace = upcomingRaces.find((r) => r.distance === target.distance && r !== nextRaceSpotlight?.race)
          const achieved = !!pb && target.targetSeconds !== null && pb.entry.seconds <= target.targetSeconds
          const predictionFallback =
            predictions.find((p) => p.key === DISTANCE_KEY[target.distance])?.predictedSeconds ?? null

          return (
            <GlassSurface
              key={target.distance}
              variant="card"
              className="rounded-card-sm p-4"
              style={achieved ? { background: 'rgba(30,215,135,0.18)', borderColor: 'rgba(30,215,135,0.4)' } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{shortDist(target.distance)}</span>
                <span className="shrink-0 text-xs text-subtle">
                  {target.targetSeconds !== null ? `${s.target} ${formatDuration(target.targetSeconds)}` : s.noTarget}
                </span>
              </div>

              {isSpotlight && nextRaceSpotlight ? (
                <>
                  <p className="mt-1.5 flex items-baseline gap-1.5 text-xl font-bold text-foreground">
                    {nextRaceSpotlight.predictedSeconds !== null ? formatDuration(nextRaceSpotlight.predictedSeconds) : '-'}
                    <span className="text-xs font-normal text-subtle">{s.predictedTag}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-subtle">
                    {nextRaceSpotlight.race.name} · {formatDate(nextRaceSpotlight.race.date)} ·{' '}
                    {t.nextRace.countdown(nextRaceSpotlight.daysUntil)}
                  </p>
                </>
              ) : pb ? (
                <>
                  <p className={cn('mt-1.5 flex items-center gap-1.5 text-xl font-bold', achieved ? STATUS.success.text : 'text-foreground')}>
                    {formatDuration(pb.entry.seconds)}
                    {achieved && <Check size={15} strokeWidth={3} />}
                    {!achieved && target.targetSeconds !== null && (
                      <span className={cn('text-sm font-semibold', gapDisplay(pb.entry.seconds - target.targetSeconds).className)}>
                        {gapDisplay(pb.entry.seconds - target.targetSeconds).label}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-subtle">
                    {achieved
                      ? `${formatDate(pb.activity.date)}${pb.activity.description ? ` · ${pb.activity.description}` : ''}`
                      : `${s.best} · ${formatDate(pb.activity.date)}${
                          otherRace ? ` · ${s.nextRaceHint(otherRace.name, formatCompactDate(otherRace.date))}` : ''
                        }`}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-sm font-medium text-subtle">
                    {target.targetSeconds === null ? s.noTargetSet : s.noTarget}
                  </p>
                  {predictionFallback !== null && (
                    <p className="mt-0.5 text-xs text-subtle">{t.records.predictedFromFitness(formatDuration(predictionFallback))}</p>
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
