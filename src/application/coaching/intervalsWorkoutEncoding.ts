import type { NumberRange, WorkoutBlock, WorkoutPrescription, WorkoutSegment, WorkoutSegmentKind } from '@/domain/coaching/types'
import { t } from '@/i18n'
import { garminWorkoutName, withoutEasyHeartRate } from './garminWorkoutMapping'

export interface IntervalsWorkoutEvent {
  category: 'WORKOUT'
  type: 'Run'
  start_date_local: string
  name: string
  description: string
  external_id: string
}

export class IntervalsEncodingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntervalsEncodingError'
  }
}

export const RUNOMICS_EXTERNAL_ID_PREFIX = 'runomics:'

export function intervalsExternalId(prescriptionId: string): string {
  return `${RUNOMICS_EXTERNAL_ID_PREFIX}${prescriptionId}`
}

/** Recovery goes as rest: the one recovery-like intensity intervals.icu is known to accept in its text syntax. */
const INTENSITY: Record<WorkoutSegmentKind, string | null> = {
  warmup: 'intensity=warmup',
  cooldown: 'intensity=cooldown',
  recovery: 'intensity=rest',
  effort: null,
  strides: null,
}

function clock(secondsPerKm: number): string {
  const total = Math.round(secondsPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function intervalsPace(pace: NumberRange): string {
  if (pace.min <= 0 || pace.max <= 0) throw new IntervalsEncodingError('Pace bounds must be positive seconds per kilometre')
  const faster = clock(Math.min(pace.min, pace.max))
  const slower = clock(Math.max(pace.min, pace.max))
  return faster === slower ? `${faster}/km Pace` : `${faster}-${slower}/km Pace`
}

/** "m" is minutes in intervals.icu, so a distance always goes in kilometres. */
function length(segment: WorkoutSegment): string {
  const { distanceMeters, durationSeconds } = segment.target
  if (distanceMeters !== undefined) return `${Number((distanceMeters / 1_000).toFixed(3))}km`
  if (durationSeconds !== undefined) return durationSeconds % 60 === 0 ? `${durationSeconds / 60}m` : `${durationSeconds}s`
  throw new IntervalsEncodingError('A step without a duration or distance cannot go to intervals.icu')
}

/** intervals.icu takes no absolute bpm target, so a bpm range travels in the description only. */
function target(segment: WorkoutSegment): string | null {
  if (segment.target.paceSecPerKm) return intervalsPace(segment.target.paceSecPerKm)
  if (segment.target.hrZone !== undefined) return `Z${segment.target.hrZone} HR`
  return null
}

function stepLine(segment: WorkoutSegment): string {
  return `- ${[length(segment), target(segment), INTENSITY[segment.kind]].filter(Boolean).join(' ')}`
}

function stepHints(segment: WorkoutSegment): string[] {
  const hints = [...(segment.notes ?? [])]
  if (segment.target.hrBpm) hints.push(t.coaching.garminStep.hr(segment.target.hrBpm.min, segment.target.hrBpm.max))
  if (segment.target.paceSecPerKm && segment.target.hrZone !== undefined) hints.push(t.coaching.garminStep.hrZone(segment.target.hrZone))
  return hints
}

function sections(blocks: readonly WorkoutBlock[]): string[][] {
  const result: string[][] = []
  let run: string[] = []
  for (const block of blocks) {
    if (block.kind !== 'repeat') {
      run.push(stepLine(block))
      continue
    }
    if (run.length) result.push(run)
    run = []
    result.push([`${block.repetitions}x`, ...block.steps.map(stepLine)])
  }
  if (run.length) result.push(run)
  return result
}

/** A prose line starting with a dash would read as a step, and one ending in "4x" as a repeat. */
function prose(line: string): string {
  return line.replace(/^\s*[-–•*]+\s*/, '').replace(/(\d+)\s*x\s*$/i, '$1 ×')
}

export function intervalsWorkoutText(prescription: WorkoutPrescription): string {
  const workout = withoutEasyHeartRate(prescription)
  const segments = workout.blocks.flatMap((block) => (block.kind === 'repeat' ? block.steps : [block]))
  const lines = [workout.description, ...(workout.notes ?? []), ...segments.flatMap(stepHints)]
    .map(prose)
    .filter(Boolean)
  const intro = [...new Set(lines)]
  const steps = sections(workout.blocks).map((section) => section.join('\n'))
  if (!steps.length) throw new IntervalsEncodingError('A workout without steps cannot go to intervals.icu')
  return [...(intro.length ? [intro.join('\n')] : []), ...steps].join('\n\n')
}

export function toIntervalsWorkoutEvent(prescription: WorkoutPrescription): IntervalsWorkoutEvent {
  return {
    category: 'WORKOUT',
    type: 'Run',
    start_date_local: `${prescription.date}T00:00:00`,
    name: garminWorkoutName(prescription.title),
    description: intervalsWorkoutText(prescription),
    external_id: intervalsExternalId(prescription.id),
  }
}
