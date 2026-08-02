import type { ShoeDetail } from '@/application/usecases/GetShoeDetail'
import type { WearStatus } from '@/domain/shoe/wearStatus'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const SHOE_VERDICT_PREFIX = 'shoeVerdict_'
export const SHOE_VERDICT_LIMITS = { headline: 44, body: 130 }

export function shoeVerdictSurface(gearId: string): string {
  return `${SHOE_VERDICT_PREFIX}${gearId}`
}

export interface ShoeVerdictContext {
  shoe: ShoeDetail
  status: Exclude<WearStatus, 'ok'>
  kmLeft: number
  weeksRemaining: number | null
}

// Wear is quantised to the nearest 5% so a single run does not invalidate the
// copy: the verdict on a shoe at 82% and at 84% is the same verdict.
const WEAR_STEP = 5

function facts({ shoe, status, kmLeft, weeksRemaining }: ShoeVerdictContext) {
  return {
    name: shoe.name,
    status,
    wearBand: Math.round(shoe.wearPercent / WEAR_STEP) * WEAR_STEP,
    kmLeft,
    weeksRemaining,
    kmPerWeek: Math.round(shoe.kmPerWeek),
  }
}

export function shoeVerdictInsightHash(context: ShoeVerdictContext): string {
  return insightHash(facts(context))
}

/**
 * The status badge sits on the same screen as this copy. A pair drifting a few
 * kilometres deeper into the same status reads the same either way, but one that
 * has crossed into "replace" cannot keep yesterday's "they have a block left in
 * them" under a red badge - so the status gates the grace window.
 */
export function shoeVerdictInsightGuard(context: ShoeVerdictContext): string {
  return insightHash({ status: context.status })
}

export const SHOE_VERDICT_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the wear verdict at the top of a shoe page, for a pair getting close to the end of its life.',
    'one sentence on when to replace them and what to do until then',
    SHOE_VERDICT_LIMITS
  ),
  // The wear bar, the km total and the status badge are all on the same screen.
  'The wear percentage, the kilometres run and the status label are already printed on the page: never restate them.',
  'Be practical. Never suggest a specific shoe model or a shop.',
].join(' ')

export function shoeVerdictInsightPrompt(context: ShoeVerdictContext, recentHeadlines: string[]): string {
  const f = facts(context)

  return [
    'Facts:',
    `- Wear status: ${f.status === 'replace' ? 'past its usable life' : 'approaching the end of its life'}`,
    `- Kilometres left before the limit: ${f.kmLeft}`,
    f.weeksRemaining !== null
      ? `- At ${f.kmPerWeek} km a week, that is about ${f.weeksRemaining} weeks`
      : '- Not enough recent mileage to project how long that lasts',
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
