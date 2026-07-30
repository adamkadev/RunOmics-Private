import type { AnalyticsTabFacts } from './GetAnalyticsTabFacts'
import {
  ANALYTICS_TAB_IDS,
  analyticsTabInsightHash,
  analyticsTabSurface,
  type AnalyticsTabId,
} from '@/domain/ai/analyticsTabInsight'
import { readVerifiedInsight } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Insight } from '@/lib/gemini'

export type AnalyticsTabInsights = Partial<Record<AnalyticsTabId, Insight>>

/** The AI answer to each tab's question, for whichever tabs have a fresh one. */
export async function getAnalyticsTabInsights(facts: AnalyticsTabFacts): Promise<AnalyticsTabInsights> {
  const entries = await Promise.all(
    ANALYTICS_TAB_IDS.map(async (tab) => {
      const lines = facts[tab]
      if (!lines.length) return [tab, null] as const
      return [tab, await readVerifiedInsight(analyticsTabSurface(tab), analyticsTabInsightHash(tab, lines))] as const
    })
  )

  return Object.fromEntries(entries.filter(([, insight]) => insight !== null))
}
