import type { SeasonHeadlineData } from '@/application/usecases/GetSeasonHeadline'
import { HERO_POOL } from './budget'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const SEASON_SURFACE = 'seasonHeadline'
export const SEASON_LIMITS = { headline: 64, body: 160 }

// Also one call a day at most, and it shares the hero's daily budget comfortably.
export const SEASON_POOL = HERO_POOL

function facts(data: SeasonHeadlineData) {
  return Object.fromEntries(data.bullets.map((b, i) => [`bullet${i}`, `${b.tone}:${b.text}`]))
}

export function seasonInsightHash(data: SeasonHeadlineData): string {
  return insightHash(facts(data))
}

export const SEASON_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach naming what an athlete season has actually done, in the card that opens their analytics page.',
    'one sentence tying the reads together into a single takeaway',
    SEASON_LIMITS
  ),
  'The individual reads are already listed as bullets under your text, so do not restate them one by one.',
].join(' ')

export function seasonInsightPrompt(data: SeasonHeadlineData, recentHeadlines: string[]): string {
  return [
    'Reads from this season so far, each tagged with whether it is a gain or a concern:',
    ...data.bullets.map((b) => `- (${b.tone}) ${b.text}`),
    avoidClause(recentHeadlines),
  ].join('\n')
}
