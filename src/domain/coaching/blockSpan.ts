import type { CoachingPlan } from './types'

export interface BlockSpan {
  name: string
  startDate: string
  endDate: string
}

type PlanBlock = Pick<CoachingPlan, 'id' | 'block' | 'weeks'>

const dayBefore = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)

/** A renewal keeps the outgoing block's last days under their old ids, so they do not open the new block. */
export function ownBlockStart(plan: PlanBlock): string {
  const own = plan.weeks.find((week) => week.workouts.some((workout) => workout.id.startsWith(`${plan.id}:`)))
  return own && own.startDate > plan.block.startDate ? own.startDate : plan.block.startDate
}

/** A superseded block ran only until the next one began, and a rewrite of the same block replaces it. */
export function pastBlocks<P extends PlanBlock & Pick<CoachingPlan, 'provenance'>>(current: PlanBlock, archived: readonly P[]): { plan: P; span: BlockSpan }[] {
  const currentStart = ownBlockStart(current)
  const byStart = new Map<string, P>()
  for (const plan of archived) {
    const start = ownBlockStart(plan)
    const held = byStart.get(start)
    if (!held || plan.provenance.createdAt > held.provenance.createdAt) byStart.set(start, plan)
  }
  const starts = [...byStart.keys()].filter((start) => start < currentStart).sort()
  return starts.flatMap((start, index) => {
    const plan = byStart.get(start)!
    const next = starts[index + 1] ?? currentStart
    const endDate = plan.block.endDate < next ? plan.block.endDate : dayBefore(next)
    return endDate < start ? [] : [{ plan, span: { name: plan.block.name, startDate: start, endDate } }]
  })
}

export function pastBlockSpans(current: PlanBlock, archived: readonly (PlanBlock & Pick<CoachingPlan, 'provenance'>)[]): BlockSpan[] {
  return pastBlocks(current, archived).map(({ span }) => span)
}
