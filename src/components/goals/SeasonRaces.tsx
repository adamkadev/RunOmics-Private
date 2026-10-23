'use client'

import { DAY_MS } from '@/lib/calendarDate'
import type { GoalTarget, YearData } from '@/application/usecases/GetGoalsData'
import { DISTANCE_KEY } from '@/domain/activity/effort'
import { formatCountdown, formatDate, formatDuration } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'
import { shortDist } from './shortDistance'
import { raceDisplayName } from './raceName'

export interface SeasonRaceRow {
  distance: string
  sortKey: string
  kind: 'done' | 'scheduled' | 'open'
  title: string
  /** The race's own name, or the distance where it has none. */
  name: string
  /** Date, then target or outcome - joined with a middle dot. */
  sub: string[]
  countdownText: string | null
  isNext: boolean
  value: string
  valueClassName: string
  /** What the value is: a prediction or a finish. */
  valueSub: string
  achieved: boolean
  /** The race day; null for a target with no date yet. */
  date: string | null
  /** "10K", "Half". */
  short: string
  targetSeconds: number | null
  /** The prediction ahead of a race, the result after it. */
  seconds: number | null
  daysUntil: number | null
}

function outcomeLine(seconds: number, targetSeconds: number): string {
  const gap = seconds - targetSeconds
  return gap <= 0 ? t.goals.beatenBy(formatDuration(Math.abs(gap))) : t.goals.missedBy(formatDuration(gap))
}

export function seasonRaceRows(yearData: YearData, today: string): SeasonRaceRow[] {
  const { goals, pbs, upcomingRaces, nextRaceSpotlight, predictions } = yearData
  const s = t.goals
  // A year with races but no goals file still lists its races.
  const targets = goals?.targets ?? []
  if (targets.length === 0 && upcomingRaces.length === 0) return []

  const targetDistances = new Set(targets.map((target) => target.distance))
  const extraDistances = [...new Set(upcomingRaces.map((race) => race.distance))].filter(
    (distance) => !targetDistances.has(distance)
  )
  const allTargets: GoalTarget[] = [
    ...targets,
    ...extraDistances.map((distance) => ({
      distance,
      targetSeconds: upcomingRaces.find((race) => race.distance === distance)?.targetSeconds ?? null,
    })),
  ]

  return allTargets.map((target): SeasonRaceRow => {
    const pb = pbs.find((p) => p.entry.distance === target.distance)
    const isSpotlight = nextRaceSpotlight?.race.distance === target.distance
    const otherRace = upcomingRaces.find((r) => r.distance === target.distance && r !== nextRaceSpotlight?.race)
    const scheduledRace = isSpotlight ? nextRaceSpotlight!.race : otherRace ?? null
    const targetLine = target.targetSeconds !== null ? s.targetTime(formatDuration(target.targetSeconds)) : null
    const rawPredicted = predictions.find((p) => p.key === DISTANCE_KEY[target.distance])?.predictedSeconds ?? null

    // The watch's prediction, never the best standing in for it: the column heads the number as predicted.
    const predictedSeconds = isSpotlight ? nextRaceSpotlight!.predictedSeconds : rawPredicted
    const predictedSub = s.predictedTag

    if (scheduledRace) {
      const raceDate = formatDate(scheduledRace.date, { style: 'bare' })
      const hasPassed = scheduledRace.date < today
      const name = raceDisplayName({ ...scheduledRace, distance: target.distance })
      const title = `${shortDist(target.distance)} · ${name}`

      if (hasPassed) {
        const result =
          pbs.find((p) => p.entry.distance === target.distance && p.activity.date === scheduledRace.date) ?? null
        const achieved = result !== null && target.targetSeconds !== null && result.entry.seconds <= target.targetSeconds
        return {
          distance: target.distance,
          sortKey: scheduledRace.date,
          kind: 'done',
          title,
          name,
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
          date: scheduledRace.date,
          short: shortDist(target.distance),
          targetSeconds: target.targetSeconds,
          seconds: result?.entry.seconds ?? null,
          daysUntil: null,
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
        name,
        sub: [raceDate, targetLine].filter((part): part is string => part !== null),
        countdownText: daysUntil >= 0 ? formatCountdown(daysUntil) : null,
        isNext: isSpotlight,
        value: predictedSeconds !== null ? formatDuration(predictedSeconds) : '-',
        valueClassName: 'text-foreground',
        valueSub: predictedSeconds !== null ? predictedSub : s.predictedTag,
        achieved: false,
        date: scheduledRace.date,
        short: shortDist(target.distance),
        targetSeconds: target.targetSeconds,
        seconds: predictedSeconds,
        daysUntil,
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
        name: pb.activity.description || shortDist(target.distance),
        sub: [formatDate(pb.activity.date, { style: 'bare' }), targetLine].filter((part): part is string => part !== null),
        countdownText: null,
        isNext: false,
        value: formatDuration(pb.entry.seconds),
        valueClassName: achieved ? STATUS.success.text : 'text-foreground',
        valueSub: target.targetSeconds !== null ? outcomeLine(pb.entry.seconds, target.targetSeconds) : s.finish,
        achieved,
        date: pb.activity.date,
        short: shortDist(target.distance),
        targetSeconds: target.targetSeconds,
        seconds: pb.entry.seconds,
        daysUntil: null,
      }
    }

    return {
      distance: target.distance,
      sortKey: '9999-99-99',
      kind: 'open',
      title: shortDist(target.distance),
      name: shortDist(target.distance),
      sub: [s.noDateSet, targetLine].filter((part): part is string => part !== null),
      countdownText: null,
      isNext: false,
      value: rawPredicted !== null ? formatDuration(rawPredicted) : '-',
      valueClassName: rawPredicted !== null ? 'text-muted-foreground' : 'text-subtle',
      valueSub: s.predictedTag,
      achieved: false,
      date: null,
      short: shortDist(target.distance),
      targetSeconds: target.targetSeconds,
      seconds: rawPredicted,
      daysUntil: null,
    }
  })
}
