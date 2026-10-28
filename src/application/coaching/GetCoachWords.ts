import type { BlockGuideProposal, CoachingPlan, WorkoutBlock, WorkoutSegmentKind } from '@/domain/coaching/types'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'

export interface CoachWeekWords {
  startDate: string
  endDate: string
  focus: string
}

export interface CoachStepWords {
  kind: WorkoutSegmentKind
  /** Inside a repeat, so its notes hold for every repetition. */
  repeated: boolean
  notes: string[]
}

export interface CoachSessionWords {
  description: string
  notes: string[]
  /** Only the steps the coach wrote a note for, in session order. */
  steps: CoachStepWords[]
}

/** The coach's own text, served by /api/coaching/words behind the site's gate and never in a page's HTML. */
export interface CoachWords {
  /** guideProposals holds only those the block left open, and is absent without one. */
  block: { name: string; focus: string; guideProposals?: BlockGuideProposal[] }
  weeks: CoachWeekWords[]
  /** By prescription id. */
  sessions: Record<string, CoachSessionWords>
}

const trimmed = (notes: readonly string[] | undefined) => (notes ?? []).map((note) => note.trim()).filter(Boolean)

function stepWords(blocks: readonly WorkoutBlock[]): CoachStepWords[] {
  return blocks
    .flatMap((block) => block.kind === 'repeat'
      ? block.steps.map((step) => ({ kind: step.kind, repeated: true, notes: trimmed(step.notes) }))
      : [{ kind: block.kind, repeated: false, notes: trimmed(block.notes) }])
    .filter((step) => step.notes.length > 0)
}

export function coachWords(plan: CoachingPlan): CoachWords {
  const sessions: Record<string, CoachSessionWords> = {}
  for (const workout of plan.weeks.flatMap((week) => week.workouts)) {
    sessions[workout.id] = { description: workout.description.trim(), notes: trimmed(workout.notes), steps: stepWords(workout.blocks) }
  }
  const open = (plan.block.guideProposals ?? []).filter((proposal) => !proposal.adopted)
  return {
    block: { name: plan.block.name.trim(), focus: plan.block.focus.trim(), ...(open.length ? { guideProposals: open } : {}) },
    weeks: plan.weeks.map((week) => ({ startDate: week.startDate, endDate: week.endDate, focus: week.focus.trim() })),
    sessions,
  }
}

export function getCoachWords(repository: Pick<CoachingRepository, 'getCurrentPlan'> = new JsonCoachingRepository()): CoachWords | null {
  const plan = repository.getCurrentPlan()
  return plan ? coachWords(plan) : null
}
