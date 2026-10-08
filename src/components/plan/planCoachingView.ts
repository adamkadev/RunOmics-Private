import type { CoachingOverview, PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { TargetEvent, TrainingBlock, WorkoutBlock, WorkoutPrescription } from '@/domain/coaching/types'
import { pickDefined } from '@/components/pickDefined'

/**
 * What /plan draws of the coaching block. The overview it is built from also
 * carries the coach's reasoning - the latest decision's summary and evidence,
 * the latest evaluation, the block's and each week's focus, and every
 * prescription's description, notes and provenance - and none of it is on
 * this screen. Handing the overview to PlanClient put all of it in the public
 * page payload; the week and month views get this instead.
 */
const PRESCRIPTION_FIELDS = [
  'id',
  'date',
  'type',
  'title',
  // A tight row's name (design review, Oct 2026), where the coach wrote one.
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
    targetEvent: PlanEvent
    tuneUpEvents?: PlanEvent[]
  }
  workouts: PlanPrescriptionView[]
}

// A segment's notes are the coach's words about it, and the structure bar
// draws only its kind and target.
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

export function planCoachingView(overview: CoachingOverview): PlanCoachingView {
  const { block, macrocycleStartDate, targetEvent, tuneUpEvents } = overview.plan
  return {
    plan: {
      block: { startDate: block.startDate, endDate: block.endDate },
      ...(macrocycleStartDate ? { macrocycleStartDate } : {}),
      targetEvent: planEvent(targetEvent),
      ...(tuneUpEvents ? { tuneUpEvents: tuneUpEvents.map(planEvent) } : {}),
    },
    workouts: overview.workouts.map((view) => ({ ...view, prescription: planPrescription(view.prescription) })),
  }
}
