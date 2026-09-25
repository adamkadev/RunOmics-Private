'use client'

import { DAY_MS } from '@/lib/calendarDate'
import { Check } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { GoalTarget, YearData } from '@/application/usecases/GetGoalsData'
import { DISTANCE_KEY } from '@/domain/activity/effort'
import { formatCountdown, formatDate, formatDuration } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { shortDist } from './shortDistance'

export interface SeasonRaceRow {
  distance: string
  sortKey: string
  kind: 'done' | 'scheduled' | 'open'
  title: string
  /** Date, then target or outcome - joined with a middle dot. */
  sub: string[]
  countdownText: string | null
  isNext: boolean
  value: string
  valueClassName: string
  /** What the value is: a prediction or a finish. */
  valueSub: string
  achieved: boolean
}

/** True when a race's name is just its distance restated ("10 km" for a 10K),
 *  the placeholder Garmin fills in until a real event name is set. */
function isPlaceholderRaceName(distance: string, name: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/\bkm\b/g, 'k').replace(/[^a-z0-9]/g, '')
  return normalize(name) === normalize(distance)
}

function outcomeLine(seconds: number, targetSeconds: number): string {
  const gap = seconds - targetSeconds
  return gap <= 0 ? t.goals.beatenBy(formatDuration(Math.abs(gap))) : t.goals.missedBy(formatDuration(gap))
}

/**
 * The season's races as rows, split into what is still ahead and what is
 * done. The timeline mixed the two in one date-sorted column, so the race you
 * were training for sat below the ones already run.
 */
export function seasonRaceRows(yearData: YearData, today: string): SeasonRaceRow[] {
  const { goals, pbs, upcomingRaces, nextRaceSpotlight, predictions } = yearData
  const s = t.goals
  if (!goals) return []

  const targetDistances = new Set(goals.targets.map((target) => target.distance))
  const extraDistances = [...new Set(upcomingRaces.map((race) => race.distance))].filter(
    (distance) => !targetDistances.has(distance)
  )
  const allTargets: GoalTarget[] = [
    ...goals.targets,
    ...extraDistances.map((distance) => ({ distance, targetSeconds: null })),
  ]

  return allTargets.map((target): SeasonRaceRow => {
    const pb = pbs.find((p) => p.entry.distance === target.distance)
    const isSpotlight = nextRaceSpotlight?.race.distance === target.distance
    const otherRace = upcomingRaces.find((r) => r.distance === target.distance && r !== nextRaceSpotlight?.race)
    const scheduledRace = isSpotlight ? nextRaceSpotlight!.race : otherRace ?? null
    const targetLine = target.targetSeconds !== null ? s.targetTime(formatDuration(target.targetSeconds)) : null
    const rawPredicted = predictions.find((p) => p.key === DISTANCE_KEY[target.distance])?.predictedSeconds ?? null

    // One prediction source (Garmin's, via GetGoalsData). Where the best is
    // already faster, the best stands in - and the row says so rather than
    // present it as a forecast.
    // The watch's prediction, labelled as one. Standing the best in for it
    // printed "= best" under a number the column heads as predicted.
    const predictedSeconds = isSpotlight ? nextRaceSpotlight!.predictedSeconds : rawPredicted
    const predictedSub = s.predictedTag

    if (scheduledRace) {
      const raceDate = formatDate(scheduledRace.date, { style: 'bare' })
      const hasPassed = scheduledRace.date < today
      const namePlaceholder = isPlaceholderRaceName(target.distance, scheduledRace.name)
      const displayName = namePlaceholder && scheduledRace.location ? scheduledRace.location : scheduledRace.name
      const title = `${shortDist(target.distance)} · ${displayName}`

      if (hasPassed) {
        const result =
          pbs.find((p) => p.entry.distance === target.distance && p.activity.date === scheduledRace.date) ?? null
        const achieved = result !== null && target.targetSeconds !== null && result.entry.seconds <= target.targetSeconds
        return {
          distance: target.distance,
          sortKey: scheduledRace.date,
          kind: 'done',
          title,
          sub: [raceDate, targetLine].filter((part): part is string => part !== null),
          countdownText: null,
          isNext: false,
          value: result !== null ? formatDuration(result.entry.seconds) : '-',
          valueClassName: achieved ? STATUS.success.text : 'text-foreground',
          valueSub:
            result !== null && target.targetSeconds !== null
              ? outcomeLine(result.entry.seconds, target.targetSeconds)
              : s.finish,
          achieved,
        }
      }

      const daysUntil = isSpotlight
        ? nextRaceSpotlight!.daysUntil
        : Math.round(
            (new Date(scheduledRace.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / DAY_MS
          )
      return {
        distance: target.distance,
        sortKey: scheduledRace.date,
        kind: 'scheduled',
        title,
        sub: [raceDate, targetLine].filter((part): part is string => part !== null),
        countdownText: daysUntil >= 0 ? formatCountdown(daysUntil) : null,
        isNext: isSpotlight,
        value: predictedSeconds !== null ? formatDuration(predictedSeconds) : '-',
        valueClassName: 'text-foreground',
        valueSub: predictedSeconds !== null ? predictedSub : s.predictedTag,
        achieved: false,
      }
    }

    if (pb) {
      const achieved = target.targetSeconds !== null && pb.entry.seconds <= target.targetSeconds
      return {
        distance: target.distance,
        sortKey: pb.activity.date,
        kind: 'done',
        title: pb.activity.description
          ? `${shortDist(target.distance)} · ${pb.activity.description}`
          : shortDist(target.distance),
        sub: [formatDate(pb.activity.date, { style: 'bare' }), targetLine].filter((part): part is string => part !== null),
        countdownText: null,
        isNext: false,
        value: formatDuration(pb.entry.seconds),
        valueClassName: achieved ? STATUS.success.text : 'text-foreground',
        valueSub: target.targetSeconds !== null ? outcomeLine(pb.entry.seconds, target.targetSeconds) : s.finish,
        achieved,
      }
    }

    return {
      distance: target.distance,
      sortKey: '9999-99-99',
      kind: 'open',
      title: shortDist(target.distance),
      sub: [s.noDateSet, targetLine].filter((part): part is string => part !== null),
      countdownText: null,
      isNext: false,
      value: rawPredicted !== null ? formatDuration(rawPredicted) : '-',
      valueClassName: rawPredicted !== null ? 'text-muted-foreground' : 'text-subtle',
      valueSub: s.predictedTag,
      achieved: false,
    }
  })
}

function RaceRow({ row }: { row: SeasonRaceRow }) {
  return (
    <div className="flex min-h-14.5 items-center gap-3 border-t border-border py-2 first:border-t-0" data-testid={`race-${row.kind}`}>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-body font-semibold', row.kind === 'open' ? 'text-muted-foreground' : 'text-foreground')}>
          {row.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {row.sub[0]}
          {row.countdownText && (
            <>
              {' · '}
              {/* Amber is the verdict on the next race only. */}
              <span className={row.isNext ? STATUS.warning.text : undefined}>{row.countdownText}</span>
            </>
          )}
          {row.sub.slice(1).map((part) => ` · ${part}`)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-base font-bold tabular-nums', row.valueClassName)}>
          {row.value}
          {row.achieved && <Check size={13} strokeWidth={3} className="ml-1 inline" />}
        </p>
        <p className={cn('text-caption', row.achieved ? STATUS.success.text : 'text-subtle')}>{row.valueSub}</p>
      </div>
    </div>
  )
}

export function SeasonRaces({ yearData, today }: { yearData: YearData; today: string }) {
  const rows = seasonRaceRows(yearData, today)
  if (rows.length === 0) return null

  // Soonest first; an undated target waits at the end of what is ahead.
  const upcoming = rows.filter((row) => row.kind !== 'done').sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  // Most recent result first.
  const done = rows.filter((row) => row.kind === 'done').sort((a, b) => b.sortKey.localeCompare(a.sortKey))

  return (
    <div className="space-y-3">
      {[
        { key: 'upcoming', label: t.goals.upcoming, rows: upcoming },
        { key: 'done', label: t.goals.doneHeading, rows: done },
      ]
        .filter((group) => group.rows.length > 0)
        .map((group) => (
          <section key={group.key} className="space-y-2" data-testid={`season-${group.key}`}>
            <SectionDivider as="h2" className="px-1">{group.label}</SectionDivider>
            <div className="glass-card rounded-card-sm px-4">
              {group.rows.map((row) => (
                <RaceRow key={row.distance} row={row} />
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}
