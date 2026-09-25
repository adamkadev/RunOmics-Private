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

interface TimelineEntry {
  distance: string
  sortKey: string
  kind: 'done' | 'scheduled' | 'open'
  dateText: string
  countdownText: string | null
  isNext: boolean
  title: string
  timeLabel: string
  timeClassName: string
  achieved: boolean
  detailLabel: string
}

const PLACEHOLDER_INK = 'rgba(148, 178, 220, 0.4)'
// Colour encodes state, weight encodes certainty. Amber is reserved for the
// verdict - the next race's D-number - and appears nowhere else here: both
// scheduled races share one blue dot regardless of urgency, and a predicted
// time is neither the link-blue of an accent nor the full weight of a result,
// so it takes this same neutral ink, one step down from full foreground.
const LATER_COUNTDOWN_INK = 'var(--muted-foreground)'
const SCHEDULED_RACE_INK = '#5a97f5'
// Tailwind's JIT scans source for literal class strings, so this repeats
// LATER_COUNTDOWN_INK's hex rather than building the class from it.
const PREDICTED_CLASS = 'text-muted-foreground'

/** True when a race's name is just its distance restated ("10 km" for a 10K),
 *  the placeholder Garmin fills in until a real event name is set. */
function isPlaceholderRaceName(distance: string, name: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/\bkm\b/g, 'k').replace(/[^a-z0-9]/g, '')
  return normalize(name) === normalize(distance)
}

export function SeasonTimeline({ yearData, today }: { yearData: YearData; today: string }) {
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

  const entries = allTargets
    .map((target): TimelineEntry => {
      const pb = pbs.find((p) => p.entry.distance === target.distance)
      const isSpotlight = nextRaceSpotlight?.race.distance === target.distance
      const otherRace = upcomingRaces.find((r) => r.distance === target.distance && r !== nextRaceSpotlight?.race)
      const scheduledRace = isSpotlight ? nextRaceSpotlight!.race : otherRace ?? null
      const achieved = !!pb && target.targetSeconds !== null && pb.entry.seconds <= target.targetSeconds
      const rawPredicted = predictions.find((p) => p.key === DISTANCE_KEY[target.distance])?.predictedSeconds ?? null

      const predictedSeconds = isSpotlight
        ? nextRaceSpotlight!.predictedSeconds
        : rawPredicted !== null && pb
          ? Math.min(rawPredicted, pb.entry.seconds)
          : rawPredicted

      const daysUntil = isSpotlight
        ? nextRaceSpotlight!.daysUntil
        : otherRace
          ? Math.round((new Date(otherRace.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / DAY_MS)
          : null

      if (scheduledRace) {
        const raceDate = formatDate(scheduledRace.date, { style: 'bare' })
        const hasPassed = scheduledRace.date < today
        const raceResult = hasPassed
          ? pbs.find((p) => p.entry.distance === target.distance && p.activity.date === scheduledRace.date) ?? null
          : null
        const raceAchieved =
          raceResult !== null && target.targetSeconds !== null && raceResult.entry.seconds <= target.targetSeconds
        const gapSeconds =
          raceResult !== null && target.targetSeconds !== null ? raceResult.entry.seconds - target.targetSeconds : null

        // Garmin fills the name field with the distance restated ("10 km") until
        // a real event name is set, so falling back to it would print the
        // distance twice - the venue is the more useful placeholder.
        const namePlaceholder = isPlaceholderRaceName(target.distance, scheduledRace.name)
        const displayName = namePlaceholder && scheduledRace.location ? scheduledRace.location : scheduledRace.name

        return {
          distance: target.distance,
          sortKey: scheduledRace.date,
          kind: hasPassed ? 'done' : 'scheduled',
          dateText: hasPassed ? `${raceDate} · ${s.done}` : raceDate,
          countdownText: !hasPassed && daysUntil !== null && daysUntil >= 0 ? formatCountdown(daysUntil) : null,
          isNext: !hasPassed && isSpotlight,
          title: `${shortDist(target.distance)} · ${displayName}`,
          timeLabel: hasPassed
            ? raceResult !== null ? formatDuration(raceResult.entry.seconds) : '-'
            : predictedSeconds !== null ? formatDuration(predictedSeconds) : '-',
          timeClassName: hasPassed
            ? raceAchieved ? STATUS.success.text : 'text-foreground'
            : PREDICTED_CLASS,
          achieved: raceAchieved,
          detailLabel: gapSeconds !== null
            ? `${s.target} ${formatDuration(target.targetSeconds!)} · ${
                gapSeconds <= 0 ? s.beatenBy(formatDuration(Math.abs(gapSeconds))) : s.missedBy(formatDuration(gapSeconds))
              }`
            // The venue is the lowest-value fact on the timeline's most urgent
            // rows, so it stays out of the detail line entirely here.
            : [
                target.targetSeconds !== null ? `${s.target} ${formatDuration(target.targetSeconds)}` : null,
                s.predictedTag,
              ].filter(Boolean).join(' · '),
        }
      }

      if (pb) {
        const gapSeconds = target.targetSeconds !== null ? pb.entry.seconds - target.targetSeconds : null
        return {
          distance: target.distance,
          sortKey: pb.activity.date,
          kind: 'done',
          dateText: `${formatDate(pb.activity.date, { style: 'bare' })} · ${s.done}`,
          countdownText: null,
          isNext: false,
          title: pb.activity.description
            ? `${shortDist(target.distance)} · ${pb.activity.description}`
            : shortDist(target.distance),
          timeLabel: formatDuration(pb.entry.seconds),
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
        dateText: s.noDateSet,
        countdownText: null,
        isNext: false,
        title: shortDist(target.distance),
        timeLabel: rawPredicted !== null ? formatDuration(rawPredicted) : '-',
        timeClassName: rawPredicted !== null ? PREDICTED_CLASS : 'text-subtle',
        achieved: false,
        detailLabel: s.findRace,
      }
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  return (
    <section className="space-y-3">
      <SectionDivider as="h2">{s.seasonTimeline}</SectionDivider>
      <div className="relative space-y-5 pl-6">
        <div className="absolute bottom-1 left-[5px] top-1 w-0.5 rounded-full bg-foreground/10" />
        {entries.map((entry) => (
          <div key={entry.distance} className="relative">
            <span
              aria-hidden
              className={cn(
                'absolute -left-6 top-0.5 h-3 w-3 rounded-full',
                entry.kind === 'done' && 'bg-[#34d399] ring-4 ring-[#34d399]/20',
                entry.kind === 'open' && 'border-[1.5px] border-dashed',
              )}
              style={
                entry.kind === 'open'
                  ? { borderColor: PLACEHOLDER_INK }
                  // The dot is state (done / scheduled / undated), not urgency -
                  // two races in the same state take the same colour. Urgency is
                  // carried entirely by the amber D-number on the imminent race.
                  : entry.kind === 'scheduled'
                    ? { backgroundColor: SCHEDULED_RACE_INK, boxShadow: `0 0 0 4px ${SCHEDULED_RACE_INK}33` }
                    : undefined
              }
            />
            <p className="text-xs text-subtle">
              {entry.dateText}
              {entry.countdownText && (
                <>
                  {' · '}
                  <span
                    className={entry.isNext ? STATUS.warning.text : undefined}
                    style={entry.isNext ? undefined : { color: LATER_COUNTDOWN_INK }}
                  >
                    {entry.countdownText}
                  </span>
                </>
              )}
            </p>
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn('min-w-0 truncate font-semibold', entry.kind === 'open' ? 'text-muted-foreground' : 'text-foreground')}>
                {entry.title}
              </span>
              <span className={cn('shrink-0 text-[15px] font-bold', entry.timeClassName)}>
                {entry.timeLabel}
                {entry.achieved && <Check size={13} strokeWidth={3} className="ml-1 inline" />}
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
