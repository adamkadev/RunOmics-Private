import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const ANALYTICS_TAB_IDS = ['fitness', 'performance', 'volume', 'health'] as const
export type AnalyticsTabId = (typeof ANALYTICS_TAB_IDS)[number]

export const ANALYTICS_TAB_PREFIX = 'analyticsTab_'
export const ANALYTICS_TAB_LIMITS = { headline: 52, body: 150 }

export function analyticsTabSurface(tab: AnalyticsTabId): string {
  return `${ANALYTICS_TAB_PREFIX}${tab}`
}

// The question each tab exists to answer - the same one the tab label promises.
const TAB_QUESTION: Record<AnalyticsTabId, string> = {
  fitness: 'Am I fit?',
  performance: 'Am I getting faster?',
  volume: 'How much am I running?',
  health: 'Is my training healthy?',
}

export function analyticsTabInsightHash(tab: AnalyticsTabId, facts: string[]): string {
  return insightHash({ tab, ...Object.fromEntries(facts.map((fact, i) => [`fact${i}`, fact])) })
}

export function analyticsTabSystemInstruction(tab: AnalyticsTabId): string {
  return [
    systemInstruction(
      `You are a running coach answering one question at the top of an athlete analytics screen: "${TAB_QUESTION[tab]}".`,
      'one sentence backing the answer with what the numbers actually show',
      ANALYTICS_TAB_LIMITS
    ),
    'Answer that question and nothing else. The charts below hold every other detail.',
    // Fifteen charts sit under this line: naming one of them back is the one
    // thing the reader can already see for themselves.
    'Do not describe a chart or restate a series. Say what the numbers mean for the athlete.',
  ].join(' ')
}

export function analyticsTabInsightPrompt(facts: string[], recentHeadlines: string[]): string {
  return ['Reads behind this screen:', ...facts.map((fact) => `- ${fact}`), avoidClause(recentHeadlines)].join('\n')
}
