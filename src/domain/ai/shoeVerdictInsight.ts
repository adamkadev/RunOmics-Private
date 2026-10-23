import type { ShoeDetail } from '@/domain/shoe/types'
import type { WearStatus } from '@/domain/shoe/wearStatus'
import { insightHash } from './insightHash'
import { avoidClause, CARD_PROMPT_VERSION, promptVersion, systemInstruction } from './prompt'

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

const WEAR_STEP = 5

function facts({ shoe, status, kmLeft, weeksRemaining }: ShoeVerdictContext) {
  return {
    promptVersion: promptVersion(CARD_PROMPT_VERSION),
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

export function shoeVerdictInsightGuard(context: ShoeVerdictContext): string {
  return insightHash({ status: context.status })
}

export const SHOE_VERDICT_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the wear verdict at the top of a shoe page, for a pair getting close to the end of its life.',
    'one sentence on when to replace them and what to do until then',
    SHOE_VERDICT_LIMITS
  ),
  'The wear percentage, the kilometres run, the kilometres left and the status label are already printed on the page: never restate them.',
  'Be practical. Never suggest a specific shoe model or a shop.',
].join(' ')

export function shoeVerdictInsightPrompt(context: ShoeVerdictContext, recentHeadlines: string[]): string {
  const f = facts(context)

  return [
    'Facts:',
    `- Wear status: ${f.status === 'replace' ? 'past its usable life' : 'approaching the end of its life'}`,
    f.kmLeft > 0 ? `- Kilometres left before the limit, printed on the page: ${f.kmLeft}` : '- Already past its kilometre limit',
    f.kmLeft <= 0
      ? null
      : f.weeksRemaining !== null
        ? `- At ${f.kmPerWeek} km a week, that is about ${f.weeksRemaining} week${f.weeksRemaining === 1 ? '' : 's'}`
        : '- Not enough recent mileage to project how long that lasts',
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
