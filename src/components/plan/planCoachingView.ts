import type { CoachingOverview, PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { CoachReadout } from '@/application/coaching/GetCoachReadout'
import type { TargetEvent, TrainingBlock, WorkoutBlock, WorkoutPrescription } from '@/domain/coaching/types'
import { pickDefined } from '@/components/pickDefined'

/** Only what /plan draws: the overview also carries the coach's reasoning, which must stay out of the public page payload. */
const PRESCRIPTION_FIELDS = [
  'id',
  'date',
  'type',
  'title',
  'shortName',
  'totalDurationSeconds',
  'totalDistanceMeters',
  'blocks',
] as const satisfies readonly (keyof WorkoutPrescription)[]

const EVENT_FIELDS = [
  'date',
  'name',
  'role',
  'distanceLabel',
  'location',
  'targetSeconds',
] as const satisfies readonly (keyof TargetEvent)[]

export type PlanPrescription = Pick<WorkoutPrescription, (typeof PRESCRIPTION_FIELDS)[number]>

export interface PlanPrescriptionView extends Omit<PrescriptionView, 'prescription'> {
  prescription: PlanPrescription
}

export type PlanEvent = Pick<TargetEvent, (typeof EVENT_FIELDS)[number]>

export interface PlanCoachingView {
  plan: {
    block: Pick<TrainingBlock, 'startDate' | 'endDate'>
    macrocycleStartDate?: string
    targetEvent?: PlanEvent
    tuneUpEvents?: PlanEvent[]
  }
  workouts: PlanPrescriptionView[]
  readout?: CoachReadout
}

function withoutNotes(block: WorkoutBlock): WorkoutBlock {
  if (block.kind === 'repeat') {
    return { kind: 'repeat', repetitions: block.repetitions, steps: block.steps.map(({ kind, target }) => ({ kind, target })) }
  }
  return { kind: block.kind, target: block.target }
}

function planPrescription(prescription: WorkoutPrescription): PlanPrescription {
  return pickDefined({ ...prescription, blocks: prescription.blocks.map(withoutNotes) }, PRESCRIPTION_FIELDS)
}

function planEvent(event: TargetEvent): PlanEvent {
  return pickDefined(event, EVENT_FIELDS)
}

export function planCoachingView(overview: CoachingOverview, readout?: CoachReadout): PlanCoachingView {
  const { block, macrocycleStartDate, targetEvent, tuneUpEvents } = overview.plan
  return {
    plan: {
      block: { startDate: block.startDate, endDate: block.endDate },
      ...(macrocycleStartDate ? { macrocycleStartDate } : {}),
      ...(targetEvent ? { targetEvent: planEvent(targetEvent) } : {}),
      ...(tuneUpEvents ? { tuneUpEvents: tuneUpEvents.map(planEvent) } : {}),
    },
    workouts: overview.workouts.map((view) => ({ ...view, prescription: planPrescription(view.prescription) })),
    ...(readout ? { readout } : {}),
  }
}
