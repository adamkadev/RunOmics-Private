import type { RaceReadiness } from '@/application/usecases/GetRaceReadiness'
import { SUPPORTING_MODEL } from './budget'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'
import { formatClock } from '@/lib/formatters'

export const RACE_READINESS_SURFACE = 'raceReadiness'
export const RACE_READINESS_LIMITS = { headline: 44, body: 140 }

// Only the next race is ever shown, so this is one document that follows the
// countdown down to race day.
export const RACE_READINESS_MODEL = SUPPORTING_MODEL

// Form is quantised so the copy tracks the phase rather than the daily wobble
// of a TSB estimate: a projected +3.2 and +4.1 call for the same advice.
const FORM_STEP = 5

function band(tsb: number): number {
  return Math.round(tsb / FORM_STEP) * FORM_STEP
}

function facts(readiness: RaceReadiness) {
  return {
    race: readiness.race.name,
    distance: readiness.race.distance,
    daysUntil: readiness.daysUntil,
    phase: readiness.phase,
    form: band(readiness.tsb),
    projectedForm: band(readiness.projectedTsb),
    verdict: readiness.projectedVerdict,
    predictedSeconds: readiness.predictedSeconds,
  }
}

export function raceReadinessInsightHash(readiness: RaceReadiness): string {
  return insightHash(facts(readiness))
}

export const RACE_READINESS_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the readiness note on the card counting down to an athlete next race.',
    'one sentence on what this phase of the countdown asks for',
    RACE_READINESS_LIMITS
  ),
  // The three tiles under this line already carry today's form, the projected
  // form and the predicted time.
  'The countdown, the form values and the predicted time are printed on the same card: never restate them.',
  'Never promise a result. Talk about how to train between now and the start line.',
].join(' ')

export function raceReadinessInsightPrompt(readiness: RaceReadiness, recentHeadlines: string[]): string {
  const f = facts(readiness)

  return [
    'Facts:',
    `- Race: ${f.race} (${f.distance}), in ${f.daysUntil} days`,
    `- Countdown phase: ${f.phase}`,
    `- Form today (TSB, positive = fresh): around ${f.form}`,
    `- Form projected for race day if training carries on: around ${f.projectedForm}, read as "${f.verdict}"`,
    f.predictedSeconds ? `- Predicted finish from current fitness: ${formatClock(f.predictedSeconds)}` : null,
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
