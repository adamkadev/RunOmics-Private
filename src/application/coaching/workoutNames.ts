import type { BootstrapWorkoutDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { NumberRange, WorkoutBlock, WorkoutNameStructure, WorkoutRepeatBlock, WorkoutSegment } from '@/domain/coaching/types'
import { segmentSeconds } from './intensity'
import { segmentMeters, segments } from './volume'

/**
 * A name is its type, then " · " and its structure ("Threshold · 3 × 8′ @ 4:25"), or the type alone.
 * The app prints it as given and never reads a figure back out of it, so the rules are held here.
 */

/** Garmin keeps 30-character names intact and a watch shows about 15, so the type leads; 28 fits a phone row. */
export const WORKOUT_NAME_MAX = 28
export const WORKOUT_SHORT_NAME_MAX = 18

type Named = Pick<BootstrapWorkoutDraft, 'type' | 'title' | 'shortName' | 'structure' | 'blocks'>

const SPACED_DASH = /\s[-–—]\s/
const ASCII_TIMES = /\d\s*[xX*]\s*\d/
const QUOTE_AFTER_DIGIT = /\d\s?['’"”]/
const ZONE = /\bZ[1-5]\b/
const PACE_RANGE = /\d:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}/
const CLOCK = /\d{1,2}:\d{2}/g
/** A pace, and only after " @ ": "@ 4:25", with no unit after it. */
const PACE = / @ (\d{1,2}):([0-5]\d)(?=$|\s)/g
const REPS = /(\d+) ×/g
/** "3 × 8′", "3 × 7′40″", "10 × 30″": a repetition's length, rounded or to the second. */
const REP_LENGTH = /(\d+) × (?:(\d+)′(?:(\d{1,2})″)?|(\d+)″)/g
// A length: after × a repetition's, anywhere else a block's or the total's.
const MINUTES = /(×\s?)?(\d+)\s?(?:min\b|′)/g
const HOURS = /(\d+)\s?h\s?(\d{2})?(?!\p{L})/gu
const KILOMETRES = /(×\s?)?(\d+(?:[.,]\d+)?)\s?km\b/gi

/** Words that start with a letter all start with a capital: "Long Run". */
function titleCase(text: string): boolean {
  const words = text.split(/\s+/).filter((word) => /^\p{L}/u.test(word))
  return words.length > 1 && words.every((word) => /^\p{Lu}/u.test(word))
}

function isWork(segment: WorkoutSegment): boolean {
  return segment.kind === 'effort' || segment.kind === 'strides'
}

function workPaces(blocks: WorkoutBlock[]): NumberRange[] {
  return segments(blocks).flatMap(({ segment }) => (isWork(segment) && segment.target.paceSecPerKm ? [segment.target.paceSecPerKm] : []))
}

function prescribesPace(blocks: WorkoutBlock[], pace: number): boolean {
  return workPaces(blocks).some((range) => pace >= range.min && pace <= range.max)
}

function repeats(blocks: WorkoutBlock[]): WorkoutRepeatBlock[] {
  return blocks.filter((block): block is WorkoutRepeatBlock => block.kind === 'repeat')
}

function repLengths(blocks: WorkoutBlock[], reps: number): number[] {
  return repeats(blocks)
    .filter((block) => block.repetitions === reps)
    .flatMap((block) => block.steps.flatMap((step) => (isWork(step) && step.target.durationSeconds !== undefined ? [step.target.durationSeconds] : [])))
}

function clockSeconds(minutes: string, seconds: string): number {
  return Number(minutes) * 60 + Number(seconds)
}

function kilometres(value: string | undefined): number {
  return Number((value ?? '').replace(',', '.'))
}

/** A length outside the repetitions is a block's own: "54 min" in "Easy · 54 min + 6 strides". */
function blockLengthProblem(name: string, blocks: WorkoutBlock[]): string | null {
  const work = blocks.filter((block): block is WorkoutSegment => block.kind !== 'repeat' && isWork(block))
  for (const [, times, minutes] of name.matchAll(MINUTES)) {
    if (!times && !work.some((block) => Math.abs(segmentSeconds(block) / 60 - Number(minutes)) <= 1)) {
      return `${minutes} min is not the length of a block the blocks prescribe`
    }
  }
  for (const [, times, value] of name.matchAll(KILOMETRES)) {
    if (!times && !work.some((block) => Math.abs(segmentMeters(block) / 1_000 - kilometres(value)) <= 0.25)) {
      return `${value} km is not the distance of a block the blocks prescribe`
    }
  }
  return null
}

function totals(blocks: WorkoutBlock[]): { minutes: number | null; km: number | null } {
  let seconds = 0
  let meters = 0
  let timed = true
  let measured = true
  for (const { segment, repetitions } of segments(blocks)) {
    const segmentTime = segmentSeconds(segment)
    const segmentDistance = segmentMeters(segment)
    if (segmentTime > 0) seconds += segmentTime * repetitions
    else timed = false
    if (segmentDistance > 0) meters += segmentDistance * repetitions
    else measured = false
  }
  return { minutes: timed ? seconds / 60 : null, km: measured ? meters / 1_000 : null }
}

/** Plan and Today print the totals beside the name already; a body's own length is not the total. */
function statesTotal(name: string, blocks: WorkoutBlock[]): boolean {
  const { minutes, km } = totals(blocks)
  if (minutes !== null) {
    for (const [, times, value] of name.matchAll(MINUTES)) {
      if (!times && Math.abs(Number(value) - minutes) <= 1) return true
    }
    for (const [, hours, rest] of name.matchAll(HOURS)) {
      if (Math.abs(Number(hours) * 60 + Number(rest ?? 0) - minutes) <= 1) return true
    }
  }
  if (km !== null) {
    for (const [, times, value] of name.matchAll(KILOMETRES)) {
      if (!times && Math.abs(kilometres(value) - km) <= 0.25) return true
    }
  }
  return false
}

/** A race goes by its event's own name ("10K de Metz"): exempt from the shape, case and totals rules, not from length and signs. */
function isRace(type: Named['type']): boolean {
  return type === 'race'
}

function writingProblem(text: string, type: Named['type']): string | null {
  if (!isRace(type)) {
    if (SPACED_DASH.test(text)) return 'never " - ": the type and its structure are separated by " · "'
    if (!/^\p{Lu}/u.test(text)) return 'start with the session type, capitalised'
    if (titleCase(text)) return 'use sentence case: capitalise the first word only'
  }
  if (ASCII_TIMES.test(text)) return 'write repetitions with ×: "3 × 8′", never "3 x 8"'
  if (QUOTE_AFTER_DIGIT.test(text)) return 'write minutes with the prime: "8′", never "8\'"'
  if (ZONE.test(text) || PACE_RANGE.test(text)) return 'leave the zone and the pace range out: both are shown beside the name'
  return null
}

function titleProblem(workout: Named): string | null {
  const name = workout.title
  const length = Array.from(name).length
  if (length > WORKOUT_NAME_MAX) return `${length} characters, over ${WORKOUT_NAME_MAX}: shorten it, dropping the pace first`
  const writing = writingProblem(name, workout.type)
  if (writing) return writing

  const separators = name.split('·').length - 1
  if (separators > 1 || separators !== name.split(' · ').length - 1) return 'one " · ", a space either side, between the type and its structure'
  const firstDigit = name.search(/\d/)
  if (!isRace(workout.type) && firstDigit !== -1 && (separators === 0 || firstDigit < name.indexOf(' · '))) {
    return 'the type first, then " · " and the structure: "Threshold · 3 × 8′"'
  }
  if (/\S×|×\S/.test(name)) return 'a space either side of ×: "3 × 8′"'
  const paces = [...name.matchAll(PACE)]
  if ((name.match(CLOCK) ?? []).length !== paces.length || (name.match(/@/g) ?? []).length !== paces.length) {
    return 'a repetition\'s length in minutes with ′ ("8′"), and a pace only after " @ " ("@ 4:25")'
  }

  // The name says what the blocks say, or it is a second plan.
  const counts = new Set(repeats(workout.blocks).map((block) => block.repetitions))
  for (const [, reps] of name.matchAll(REPS)) {
    if (!counts.has(Number(reps))) return `"${reps} ×" is not a repetition count the blocks prescribe`
  }
  for (const [rep, reps, minutes, seconds, onlySeconds] of name.matchAll(REP_LENGTH)) {
    const length = onlySeconds !== undefined ? Number(onlySeconds) : Number(minutes) * 60 + Number(seconds ?? 0)
    // "8′" is rounded to the minute; a length given to the second is exact.
    const tolerance = onlySeconds === undefined && seconds === undefined ? 30 : 1
    if (!repLengths(workout.blocks, Number(reps)).some((each) => Math.abs(each - length) <= tolerance)) {
      return `"${rep}" is not the repetitions the blocks prescribe`
    }
  }
  for (const [, minutes = '', seconds = ''] of paces) {
    if (!prescribesPace(workout.blocks, clockSeconds(minutes, seconds))) return `@ ${minutes}:${seconds} is not a pace the blocks prescribe`
  }
  const blockLength = blockLengthProblem(name, workout.blocks)
  if (blockLength) return blockLength
  if (!isRace(workout.type) && statesTotal(name, workout.blocks)) {
    return 'the total distance and duration are shown beside the name: leave them out of it'
  }
  return null
}

function shortNameProblem(shortName: string, type: Named['type']): string | null {
  const length = Array.from(shortName).length
  if (length > WORKOUT_SHORT_NAME_MAX) return `${length} characters, over ${WORKOUT_SHORT_NAME_MAX}`
  return writingProblem(shortName, type)
}

function structureProblem(structure: WorkoutNameStructure, blocks: WorkoutBlock[]): string | null {
  const reps = structure.reps ?? 1
  if (reps > 1 && !repeats(blocks).some((block) => block.repetitions === reps)) return `reps ${reps} is not a repetition count the blocks prescribe`
  if (structure.repMinutes !== undefined) {
    const lengths = reps > 1
      ? repLengths(blocks, reps)
      : blocks.flatMap((block) => (block.kind !== 'repeat' && isWork(block) && block.target.durationSeconds !== undefined ? [block.target.durationSeconds] : []))
    const seconds = structure.repMinutes * 60
    if (!lengths.some((length) => Math.abs(length - seconds) <= 30)) {
      return `repMinutes ${structure.repMinutes} is not a repetition the blocks prescribe, to the nearest minute`
    }
  }
  if (structure.targetPace !== undefined) {
    const [minutes = '', seconds = ''] = structure.targetPace.split(':')
    if (!prescribesPace(blocks, clockSeconds(minutes, seconds))) return `targetPace ${structure.targetPace} is not a pace the blocks prescribe`
  }
  if (structure.extras?.some((extra) => SPACED_DASH.test(extra) || Array.from(extra).length > WORKOUT_NAME_MAX)) {
    return `each extra is a few words ("6 strides"), at most ${WORKOUT_NAME_MAX} characters and without " - "`
  }
  return null
}

/** A title the live plan already held (`titleAsWritten`) is left as it was: past plans keep their names. */
export function validateWorkoutName(workout: Named, label: string, { titleAsWritten = false }: { titleAsWritten?: boolean } = {}): void {
  if (!titleAsWritten) {
    const problem = titleProblem(workout)
    if (problem) throw new Error(`${label}.title "${workout.title}": ${problem}`)
    if (!workout.shortName) {
      throw new Error(`${label}.shortName: every workout carries one of at most ${WORKOUT_SHORT_NAME_MAX} characters, its name when that already fits`)
    }
  }
  if (workout.shortName) {
    const problem = shortNameProblem(workout.shortName, workout.type)
    if (problem) throw new Error(`${label}.shortName "${workout.shortName}": ${problem}`)
  }
  if (workout.structure) {
    const problem = structureProblem(workout.structure, workout.blocks)
    if (problem) throw new Error(`${label}.structure: ${problem}`)
  }
}

export function validateDraftNames(draft: CoachingPlanDraft): void {
  draft.weeks.forEach((week, weekIndex) => week.workouts.forEach((workout, workoutIndex) =>
    validateWorkoutName(workout, `plan.weeks[${weekIndex}].workouts[${workoutIndex}]`)
  ))
}
