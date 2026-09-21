import type { ShoeVerdictContext } from '@/domain/ai/shoeVerdictInsight'
import { shoeVerdictInsightGuard, shoeVerdictInsightHash, shoeVerdictSurface } from '@/domain/ai/shoeVerdictInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

export async function getShoeVerdictInsight(context: ShoeVerdictContext): Promise<Insight | null> {
  return readVerifiedInsight(shoeVerdictSurface(context.shoe.gearId), {
    hash: shoeVerdictInsightHash(context),
    guard: shoeVerdictInsightGuard(context),
  })
}
