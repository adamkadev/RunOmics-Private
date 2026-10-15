import { DAY_MS } from '@/lib/calendarDate'
import { hasCoursePacing } from '@/domain/coaching/coursePacing'
import type { CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { CoachingContext } from '@/application/coaching/context'
import type { TargetEvent } from '@/domain/coaching/types'
import { finishSecondsFromPace, formatRaceTime, raceTargetFacts } from '@/domain/coaching/raceTarget'

export interface BootstrapEvents {
  primary: TargetEvent | null
  tuneUps: TargetEvent[]
  planningStartDate: string
}

const PRE_RACE_HARD_TYPES = new Set(['tempo', 'threshold', 'vo2max', 'anaerobic', 'sprint', 'long_run'])
const POST_RACE_RECOVERY_TYPES = new Set(['easy', 'recovery'])

export interface BootstrapRecoveryFacts {
  required: boolean
  completedRaceDate?: string
  recoveryThroughDate?: string
  recentRuns28Days: number
  longestGap28Days: number
  garminAcuteLoad: number | null
  garminChronicLoad: number | null
  garminLoadStatus: string | null
  acwr: number | null
  tsb: number | null
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function bootstrapRecoveryFacts(
  context: CoachingContext,
  planningStartDate: string,
): BootstrapRecoveryFacts {
  const previousDate = addDays(planningStartDate, -1)
  const completedRace = context.recentActivities.find(
    (activity) => activity.type === 'Race' && activity.date === previousDate,
  )
  return {
    required: completedRace !== undefined,
    ...(completedRace
      ? {
          completedRaceDate: completedRace.date,
          recoveryThroughDate: addDays(completedRace.date, 3),
        }
      : {}),
    recentRuns28Days: context.volume.runs28Days,
    longestGap28Days: context.gaps.longestGap28Days,
    garminAcuteLoad: context.load.garminAcuteLoad,
    garminChronicLoad: context.load.garminChronicLoad,
    garminLoadStatus: context.load.garminLoadStatus,
    acwr: context.load.acwr,
    tsb: context.load.tsbNow ?? context.load.tsb,
  }
}

// A French deployment's coach writes its prose in French (COACHING_LANGUAGE_RULE):
// « objectif 40 minutes », « en moins de 45 min », « allure recommandée ».
const FRENCH_GOAL = 'objectif|cible|arriv(?:ée|ee)|terminer|finir|boucler'
const DURATION_UNIT = 'hours?|hrs?|heures?|minutes?|mins?|seconds?|secs?|secondes?'

function finishTimeClaims(value: string): number[] {
  const claims: number[] = []
  const clockPattern = /\b(\d{1,3}):(\d{2})(?::(\d{2}))?\b/g
  for (const match of value.matchAll(clockPattern)) {
    const suffix = value.slice((match.index ?? 0) + match[0].length)
    if (/^\s*(?:\/|per\s+|par\s+)km\b/i.test(suffix)) continue
    const first = Number(match[1])
    const second = Number(match[2])
    const third = match[3] === undefined ? undefined : Number(match[3])
    if (second >= 60 || (third !== undefined && third >= 60)) continue
    claims.push(third === undefined ? first * 60 + second : first * 3_600 + second * 60 + third)
  }

  const namedPattern = new RegExp(`\\b(?:goal|target|finish(?:ing)?|complete(?:d)?|completion|${FRENCH_GOAL})\\b[^.!?\\n]{0,50}?\\b(\\d+(?:\\.\\d+)?)\\s*(${DURATION_UNIT})\\b`, 'gi')
  for (const match of value.matchAll(namedPattern)) claims.push(namedDurationSeconds(match[1]!, match[2]!))

  const reversedNamedPattern = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(${DURATION_UNIT})\\b[^.!?\\n]{0,30}?\\b(?:goal|target|finish(?:ing)?|completion|${FRENCH_GOAL})\\b`, 'gi')
  for (const match of value.matchAll(reversedNamedPattern)) claims.push(namedDurationSeconds(match[1]!, match[2]!))

  for (const match of value.matchAll(/\bsub[- ]?(\d{2,3})\b/gi)) claims.push(Number(match[1]) * 60)

  const relativeNamedPattern = /\b(?:in|under|en moins de|sous)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|heures?|minutes?|mins?)\b/gi
  for (const match of value.matchAll(relativeNamedPattern)) claims.push(namedDurationSeconds(match[1]!, match[2]!))
  return claims
}

function namedDurationSeconds(amountText: string, unit: string): number {
  const multiplier = /^(?:hours?|hrs?|heures?)$/i.test(unit) ? 3_600 : /^(?:minutes?|mins?)$/i.test(unit) ? 60 : 1
  return Math.round(Number(amountText) * multiplier)
}

function paceClaims(value: string): number[] {
  const claims: number[] = []
  for (const match of value.matchAll(/\b(\d{1,2}):(\d{2})\s*(?:\/|per\s+|par\s+)km\b/gi)) {
    const seconds = Number(match[1]) * 60 + Number(match[2])
    if (Number(match[2]) < 60) claims.push(seconds)
  }
  for (const match of value.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|secondes?)\s*(?:\/|per\s+|par\s+)km\b/gi)) {
    claims.push(Math.round(Number(match[1])))
  }
  return claims
}

function fullDistancePaceRanges(workout: CoachingPlanDraft['weeks'][number]['workouts'][number], distanceMeters: number): { min: number; max: number }[] {
  return workout.blocks.flatMap((block) =>
    block.kind === 'effort' && block.target.distanceMeters === distanceMeters && block.target.paceSecPerKm !== undefined
      ? [block.target.paceSecPerKm]
      : []
  )
}

function validateFocusProse(draft: CoachingPlanDraft): void {
  const focusProse: Array<[string, string]> = [
    ['plan.name', draft.name],
    ['plan.focus', draft.focus],
    ...draft.weeks.map((week, index): [string, string] => [`plan.weeks[${index}].focus`, week.focus]),
  ]
  for (const [label, prose] of focusProse) {
    if (finishTimeClaims(prose).length > 0 || paceClaims(prose).length > 0) {
      throw new Error(`${label} must not narrate numeric race targets; use structured event goal data`)
    }
  }
}

function validateWorkoutForEvent(
  workout: CoachingPlanDraft['weeks'][number]['workouts'][number],
  event: TargetEvent,
  prose: string,
): void {
  if (workout.type === 'race' && hasCoursePacing(event)) {
    const efforts = workout.blocks.flatMap(block => block.kind === 'repeat'
      ? Array.from({ length: block.repetitions }, () => block.steps).flat()
      : [block]).filter(segment => segment.kind === 'effort')
    const firstPace = efforts[0]?.target.paceSecPerKm
    if (firstPace && firstPace.min === firstPace.max
      && efforts.every(segment => segment.target.paceSecPerKm?.min === firstPace.min && segment.target.paceSecPerKm?.max === firstPace.max)) {
      throw new Error(`${event.name}: course-aware race pacing must not impose a constant exact pace throughout`)
    }
  }
  const claims = finishTimeClaims(prose)
  const claimedPaces = paceClaims(prose)
  const hasGoalLanguage = /\b(?:goal|target|objectif|cible)\b/i.test(prose)
  if (event.targetSeconds === undefined && claims.length > 0) {
    throw new Error(`${event.name} has no explicit time goal; race pacing must be represented as a recommendation in structured pace fields`)
  }
  if (event.targetSeconds !== undefined && claims.some((seconds) => seconds !== event.targetSeconds)) {
    throw new Error(`${event.name} prose contradicts its explicit ${formatRaceTime(event.targetSeconds)} goal`)
  }
  if (event.targetSeconds === undefined && claimedPaces.length > 0) {
    if (hasGoalLanguage || !/\brecommend(?:ed|ation)?\b|\brecommand|\bconseill/i.test(prose)) {
      throw new Error(`${event.name} has no explicit pace goal; AI pacing must be clearly described as a recommendation`)
    }
  }

  const targetPace = raceTargetFacts(event).targetPaceSecPerKm
  if (hasGoalLanguage && targetPace !== undefined && claimedPaces.some((pace) => pace !== targetPace)) {
    throw new Error(`${event.name} prose contradicts its deterministic target pace`)
  }
  if (claims.length > 0 && event.distanceMeters !== undefined) {
    const distanceMeters = event.distanceMeters
    const paceRanges = fullDistancePaceRanges(workout, distanceMeters)
    if (paceRanges.length === 1 && claims.some((seconds) => {
      const range = paceRanges[0]!
      return seconds < finishSecondsFromPace(range.min, distanceMeters)
        || seconds > finishSecondsFromPace(range.max, distanceMeters)
    })) {
      throw new Error(`${event.name} finish-time prose contradicts its structured race pace`)
    }
  }
}

function raceEvents(strategy: BootstrapEvents): TargetEvent[] {
  return strategy.primary ? [strategy.primary, ...strategy.tuneUps] : strategy.tuneUps
}

export function validateBootstrapDraftSemantics(
  draft: CoachingPlanDraft,
  strategy: BootstrapEvents,
  context: CoachingContext,
): void {
  validateFocusProse(draft)
  const events = raceEvents(strategy)
  const workouts = draft.weeks.flatMap((week) => week.workouts)
  validateRacePreparation(draft, strategy)
  const recovery = bootstrapRecoveryFacts(context, strategy.planningStartDate)
  if (recovery.required && recovery.recoveryThroughDate) {
    for (const workout of workouts) {
      if (
        workout.date >= strategy.planningStartDate
        && workout.date <= recovery.recoveryThroughDate
        && !POST_RACE_RECOVERY_TYPES.has(workout.type)
      ) {
        throw new Error(
          `${workout.title} violates post-race recovery through ${recovery.recoveryThroughDate}; `
          + 'only easy or recovery running is allowed',
        )
      }
    }
  }
  for (const event of strategy.tuneUps) {
    if (!workouts.some((workout) => workout.date === event.date && workout.type === 'race')) {
      throw new Error(`${event.name} must be represented by a race workout on ${event.date}`)
    }
    for (const workout of workouts) {
      const daysBefore = Math.round((
        new Date(`${event.date}T00:00:00Z`).getTime()
        - new Date(`${workout.date}T00:00:00Z`).getTime()
      ) / DAY_MS)
      if (daysBefore >= 1 && daysBefore <= 2 && PRE_RACE_HARD_TYPES.has(workout.type)) {
        throw new Error(`${workout.title} is too close to the ${event.name} tune-up race`)
      }
    }
  }
  for (const week of draft.weeks) {
    for (const workout of week.workouts) {
      const prose = [workout.title, workout.description, ...(workout.notes ?? [])].join('\n')
      const lowerProse = prose.toLowerCase()
      const associatedEvents = events.filter((event) =>
        event.date === workout.date || (event.name.length >= 4 && lowerProse.includes(event.name.toLowerCase()))
      )
      if (workout.type === 'race' && associatedEvents.length === 0) {
        throw new Error(`${workout.date} race workout does not match a structured event`)
      }
      for (const event of associatedEvents) validateWorkoutForEvent(workout, event, prose)
    }
  }
}

function validateRacePreparation(draft: CoachingPlanDraft, strategy: BootstrapEvents): void {
  const workouts = draft.weeks.flatMap(week => week.workouts)
  const dates = new Set(workouts.map(workout => workout.date))
  for (const event of raceEvents(strategy)) {
    if (event.targetSeconds === undefined) continue
    for (const start of [-4, -3]) {
      if ([0, 1, 2].every(offset => dates.has(addDays(event.date, start + offset)))) {
        throw new Error(`${event.name}: avoid three consecutive runs in the final four pre-race days; reduce taper frequency with an explicit reason`)
      }
    }
  }
  if (strategy.primary?.distanceMeters !== 10_000) return
  const faster = workouts.filter(workout => ['vo2max', 'anaerobic', 'sprint'].includes(workout.type))
  if (faster.length > 1) throw new Error('A 10K block permits at most one separate 5K-specific/VO2 stimulus')
  for (const stimulus of faster) {
    for (const workout of workouts) {
      if (workout.type !== 'long_run' || workout.date <= stimulus.date || workout.date > addDays(stimulus.date, 3)) continue
      const segments = workout.blocks.flatMap(block => block.kind === 'repeat' ? block.steps : [block])
      const efforts = segments.filter(segment => segment.kind === 'effort')
      const rises = efforts.some((segment, index) => {
        if (index === 0) return false
        const previous = efforts[index - 1]!.target
        const current = segment.target
        return (current.hrZone !== undefined && previous.hrZone !== undefined && current.hrZone > previous.hrZone)
          || (current.hrBpm !== undefined && previous.hrBpm !== undefined && current.hrBpm.max > previous.hrBpm.max)
          || (current.paceSecPerKm !== undefined && previous.paceSecPerKm !== undefined && current.paceSecPerKm.min < previous.paceSecPerKm.min)
      })
      if (rises || efforts.some(segment => (segment.target.hrZone ?? 0) > 2)) {
        throw new Error('Long run within three days after the 5K-specific stimulus must remain easy without a progression or faster finish')
      }
    }
  }
}
