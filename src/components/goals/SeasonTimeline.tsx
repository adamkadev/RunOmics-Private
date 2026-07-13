'use client'

import { Check } from 'lucide-react'
import type { GoalTarget, YearData } from '@/application/usecases/GetGoalsData'
import { DISTANCE_KEY } from '@/domain/activity/effort'
import { formatDayMonth, formatDuration } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { shortDist } from './YearView'

interface TimelineEntry {
  distance: string
  sortKey: string
  kind: 'done' | 'scheduled' | 'open'
  dateLabel: string
  title: string
  timeLabel: string
  timeSuffix: string | null
  timeClassName: string
  achieved: boolean
  detailLabel: string
}

export function SeasonTimeline({ yearData }: { yearData: YearData }) {
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

  const entries = allTargets
    .map((target): TimelineEntry => {
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

      if (scheduledRace) {
        const hasPassed = scheduledRace.date < today
        const raceResult = hasPassed
          ? pbs.find((p) => p.entry.distance === target.distance && p.activity.date === scheduledRace.date) ?? null
          : null
        const raceAchieved =
          raceResult !== null && target.targetSeconds !== null && raceResult.entry.seconds <= target.targetSeconds
        const gapSeconds =
          raceResult !== null && target.targetSeconds !== null ? raceResult.entry.seconds - target.targetSeconds : null

        return {
          distance: target.distance,
          sortKey: scheduledRace.date,
          kind: hasPassed ? 'done' : 'scheduled',
          dateLabel: hasPassed
            ? `${formatDayMonth(scheduledRace.date)} · ${s.done}`
            : daysUntil !== null && daysUntil >= 0
              ? `${formatDayMonth(scheduledRace.date)} · ${t.nextRace.countdown(daysUntil)}`
              : formatDayMonth(scheduledRace.date),
          title: `${shortDist(target.distance)} · ${scheduledRace.name}`,
          timeLabel: hasPassed
            ? raceResult !== null ? formatDuration(raceResult.entry.seconds) : '-'
            : predictedSeconds !== null ? formatDuration(predictedSeconds) : '-',
          timeSuffix: hasPassed ? null : s.predictedTag,
          timeClassName: hasPassed
            ? raceAchieved ? STATUS.success.text : 'text-foreground'
            : 'text-accent-text',
          achieved: raceAchieved,
          detailLabel: gapSeconds !== null
            ? `${s.target} ${formatDuration(target.targetSeconds!)} · ${
                gapSeconds <= 0 ? s.beatenBy(formatDuration(Math.abs(gapSeconds))) : s.missedBy(formatDuration(gapSeconds))
              }`
            : [
                target.targetSeconds !== null ? `${s.target} ${formatDuration(target.targetSeconds)}` : null,
                scheduledRace.location ?? null,
              ].filter(Boolean).join(' · '),
        }
      }

      if (pb) {
        const gapSeconds = target.targetSeconds !== null ? pb.entry.seconds - target.targetSeconds : null
        return {
          distance: target.distance,
          sortKey: pb.activity.date,
          kind: 'done',
          dateLabel: `${formatDayMonth(pb.activity.date)} · ${s.done}`,
          title: pb.activity.description
            ? `${shortDist(target.distance)} · ${pb.activity.description}`
            : shortDist(target.distance),
          timeLabel: formatDuration(pb.entry.seconds),
          timeSuffix: null,
          timeClassName: achieved ? STATUS.success.text : 'text-foreground',
          achieved,
          detailLabel: gapSeconds !== null
            ? `${s.target} ${formatDuration(target.targetSeconds!)} · ${
                gapSeconds <= 0 ? s.beatenBy(formatDuration(Math.abs(gapSeconds))) : s.missedBy(formatDuration(gapSeconds))
              }`
            : s.best,
        }
      }

      return {
        distance: target.distance,
        sortKey: '9999-99-99',
        kind: 'open',
        dateLabel: s.noDateSet,
        title: shortDist(target.distance),
        timeLabel: rawPredicted !== null ? formatDuration(rawPredicted) : '-',
        timeSuffix: rawPredicted !== null ? s.predictedTag : null,
        timeClassName: 'text-subtle',
        achieved: false,
        detailLabel: s.findRace,
      }
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{s.seasonTimeline}</h2>
      <div className="relative space-y-5 pl-6">
        <div className="absolute bottom-1 left-[5px] top-1 w-0.5 rounded-full bg-foreground/10" />
        {entries.map((entry) => (
          <div key={entry.distance} className="relative">
            <span
              className={cn(
                'absolute -left-6 top-0.5 h-3 w-3 rounded-full',
                entry.kind === 'done' && 'bg-accent ring-4 ring-accent/20',
                entry.kind === 'scheduled' && 'bg-orange-500 ring-4 ring-orange-500/20',
                entry.kind === 'open' && 'border-[1.5px] border-dashed border-foreground/30'
              )}
            />
            <p className={cn('text-xs', entry.kind === 'scheduled' ? 'text-orange-400' : 'text-subtle')}>
              {entry.dateLabel}
            </p>
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn('min-w-0 truncate font-semibold', entry.kind === 'open' ? 'text-muted-foreground' : 'text-foreground')}>
                {entry.title}
              </span>
              <span className={cn('shrink-0 text-sm', entry.timeClassName)}>
                {entry.timeLabel}
                {entry.achieved && <Check size={13} strokeWidth={3} className="ml-1 inline" />}
                {entry.timeSuffix && (
                  <span className={cn('ml-1 text-xs', entry.kind === 'scheduled' ? 'text-accent-text' : 'text-subtle')}>
                    {entry.timeSuffix}
                  </span>
                )}
              </span>
            </div>
            <p className={cn('text-xs', entry.kind === 'open' ? 'text-accent-text' : 'text-subtle')}>
              {entry.detailLabel}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
