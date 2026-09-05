import type {
  CoachingPlan,
  CoachingWorkoutType,
  NumberRange,
  TargetEvent,
  WorkoutBlock,
  WorkoutEvaluation,
  WorkoutPrescription,
  WorkoutSegment,
  WorkoutSegmentKind,
  WorkoutTarget,
} from '@/domain/coaching/types'
import { hasCoursePacing } from '@/domain/coaching/coursePacing'
import { formatRacePace, formatRaceTime, raceTargetFacts } from '@/domain/coaching/raceTarget'

/**
 * Plain-text rendering of the coach's future prescriptions for ImportMyWorkout.
 *
 * Everything here is derived from the prescription itself (plus the plan's own
 * race events); no pace, distance or split is ever synthesised. A prescription
 * that carries no pace target simply renders without one.
 */

export interface GarminExportWindow {
  /** Prescriptions before this date are already in the past, so never exported. */
  today: string
  /** Inclusive lower bound; defaults to `today`. */
  from?: string
  /** Inclusive upper bound; unbounded when omitted. */
  to?: string
}

export interface GarminExport {
  workouts: WorkoutPrescription[]
  startDate: string
  endDate: string
  fileName: string
  text: string
}

const HEADINGS: Record<WorkoutSegmentKind, string | null> = {
  warmup: 'Warm up:',
  cooldown: 'Cool down:',
  strides: 'Strides:',
  recovery: 'Recovery:',
  // Efforts carry the session itself: only a race names its block (see `heading`).
  effort: null,
}

/** Only sessions whose whole point is the easy effort get the word; nothing else is inferred. */
const EASY_EFFORT_TYPES: ReadonlySet<CoachingWorkoutType> = new Set(['easy', 'recovery', 'long_run'])

function completedPrescriptionIds(evaluations: WorkoutEvaluation[]): Set<string> {
  return new Set(
    evaluations
      .filter((evaluation) => evaluation.matchStatus === 'matched' && evaluation.prescriptionId)
      .map((evaluation) => evaluation.prescriptionId as string),
  )
}

/** Future prescribed/adjusted sessions only: completed, missed and cancelled ones are dropped. */
export function selectGarminExportWorkouts(
  plan: CoachingPlan,
  evaluations: WorkoutEvaluation[],
  window: GarminExportWindow,
): WorkoutPrescription[] {
  const completed = completedPrescriptionIds(evaluations)
  const from = window.from && window.from > window.today ? window.from : window.today
  return plan.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => workout.status === 'prescribed' || workout.status === 'adjusted')
    .filter((workout) => !completed.has(workout.id))
    .filter((workout) => workout.date >= from && (!window.to || workout.date <= window.to))
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
}

function formatDistance(meters: number): string {
  return meters % 1_000 === 0 ? `${meters / 1_000} km` : `${meters} m`
}

function formatDuration(seconds: number): string {
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`
}

function formatPaceRange(pace: NumberRange): string {
  return pace.min === pace.max ? formatRacePace(pace.min) : `${formatRaceTime(pace.min)}-${formatRacePace(pace.max)}`
}

/** Distance leads; a session prescribing both shows the duration alongside it. */
function quantity(target: WorkoutTarget): string {
  if (target.distanceMeters !== undefined && target.durationSeconds !== undefined) {
    return `${formatDistance(target.distanceMeters)} (${formatDuration(target.durationSeconds)})`
  }
  if (target.distanceMeters !== undefined) return formatDistance(target.distanceMeters)
  return formatDuration(target.durationSeconds ?? 0)
}

function intensity(target: WorkoutTarget): string {
  const targets = [
    target.paceSecPerKm ? formatPaceRange(target.paceSecPerKm) : '',
    target.hrBpm ? `HR ${target.hrBpm.min}-${target.hrBpm.max} bpm` : '',
    target.hrZone !== undefined ? `HR zone ${target.hrZone}` : '',
  ].filter(Boolean)
  return targets.length ? ` at ${targets.join(', ')}` : ''
}

function descriptor(kind: WorkoutSegmentKind, type: CoachingWorkoutType): string {
  if (kind === 'warmup' || kind === 'cooldown') return ' easy'
  if (kind === 'recovery') return ' easy jog recovery'
  if (kind === 'strides') return ' strides'
  return EASY_EFFORT_TYPES.has(type) ? ' easy' : ''
}

function segmentLine(segment: WorkoutSegment, type: CoachingWorkoutType): string {
  return `${quantity(segment.target)}${descriptor(segment.kind, type)}${intensity(segment.target)}`
}

function heading(segment: WorkoutSegment, workout: WorkoutPrescription): string | null {
  if (segment.kind === 'effort' && workout.type === 'race') return 'Race:'
  return HEADINGS[segment.kind]
}

function raceEvent(plan: CoachingPlan, workout: WorkoutPrescription): TargetEvent | null {
  if (workout.type !== 'race') return null
  return [plan.targetEvent, ...(plan.tuneUpEvents ?? [])].find((event) => event.date === workout.date) ?? null
}

/**
 * The plan's own goal for the race, restated on the race effort. A course-aware
 * race keeps its goal labelled as an average so it is never read back as a
 * constant-pace prescription.
 */
function raceGoalLines(event: TargetEvent, target: WorkoutTarget): string[] {
  const facts = raceTargetFacts(event)
  const lines: string[] = []
  if (facts.targetFinishTime) lines.push(`Target time: ${facts.targetFinishTime}`)
  if (facts.targetPace && !target.paceSecPerKm) {
    lines.push(`${hasCoursePacing(event) ? 'Average goal pace' : 'Goal pace'}: ${facts.targetPace}`)
  }
  return lines
}

function segmentNotes(segment: WorkoutSegment, event: TargetEvent | null, goalLines: string[]): string[] {
  const notes = segment.notes ?? []
  // The plan may already carry the average-goal wording inside the effort's own
  // notes; the explicit goal line above replaces it rather than repeating it.
  const kept = goalLines.some((line) => line.startsWith('Average goal pace'))
    ? notes.filter((note) => !/^average goal pace:/i.test(note))
    : notes
  const pacingNotes = event?.courseContext?.pacingNotes ?? []
  return [...kept, ...pacingNotes.filter((note) => !kept.includes(note))]
}

function segmentLines(segment: WorkoutSegment, workout: WorkoutPrescription, event: TargetEvent | null): string[] {
  const raced = event !== null && segment.kind === 'effort' && segment.target.distanceMeters === event.distanceMeters
  const goalLines = raced ? raceGoalLines(event, segment.target) : []
  const head = heading(segment, workout)
  return [
    ...(head ? [head] : []),
    segmentLine(segment, workout.type),
    ...goalLines,
    ...(raced ? segmentNotes(segment, event, goalLines) : segment.notes ?? []),
  ]
}

function blockLines(block: WorkoutBlock, workout: WorkoutPrescription, event: TargetEvent | null): string[] {
  if (block.kind !== 'repeat') return segmentLines(block, workout, event)
  return [
    `Repeat ${block.repetitions} time${block.repetitions === 1 ? '' : 's'}:`,
    ...block.steps.map((step) => {
      const note = (step.notes ?? []).join(' ')
      return `- ${segmentLine(step, workout.type)}${note ? ` — ${note}` : ''}`
    }),
  ]
}

function workoutNotes(workout: WorkoutPrescription): string[] {
  const notes = [workout.description, ...(workout.notes ?? [])].filter(Boolean)
  return [...new Set(notes)]
}

export function formatGarminWorkout(plan: CoachingPlan, workout: WorkoutPrescription): string {
  const event = raceEvent(plan, workout)
  const notes = workoutNotes(workout)
  const sections = [
    [`${workout.date} — ${workout.title}`, 'Sport: Running'],
    ...workout.blocks.map((block) => blockLines(block, workout, event)),
    ...(notes.length ? [['Notes:', ...notes.map((note) => `- ${note}`)]] : []),
  ]
  return sections.map((lines) => lines.join('\n')).join('\n\n')
}

/** Two blank lines keep each dated workout detectable as its own import. */
export function formatGarminWorkouts(plan: CoachingPlan, workouts: WorkoutPrescription[]): string {
  return `${workouts.map((workout) => formatGarminWorkout(plan, workout)).join('\n\n\n')}\n`
}

export function garminExportFileName(startDate: string, endDate: string): string {
  return `importmyworkout-${startDate}-to-${endDate}.txt`
}

export function buildGarminExport(
  plan: CoachingPlan,
  evaluations: WorkoutEvaluation[],
  window: GarminExportWindow,
): GarminExport | null {
  const workouts = selectGarminExportWorkouts(plan, evaluations, window)
  if (!workouts.length) return null
  const startDate = workouts[0]!.date
  const endDate = workouts[workouts.length - 1]!.date
  return {
    workouts,
    startDate,
    endDate,
    fileName: garminExportFileName(startDate, endDate),
    text: formatGarminWorkouts(plan, workouts),
  }
}
