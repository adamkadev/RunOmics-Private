import type { SeasonHeadlineData } from '@/application/usecases/GetSeasonHeadline'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const SEASON_SURFACE = 'seasonHeadline'
export const SEASON_LIMITS = { headline: 64, body: 160, bullet: 90 }

function facts(data: SeasonHeadlineData) {
  return Object.fromEntries(data.bullets.map((b, i) => [`bullet${i}`, `${b.tone}:${b.text}`]))
}

export function seasonInsightHash(data: SeasonHeadlineData): string {
  return insightHash(facts(data))
}

/**
 * The card pairs each generated bullet with the read at the same index and
 * colors it from that read's own tone (SeasonHeadline.tsx). Copy is safe to
 * outlive a figure that has drifted, but not a list that has changed shape or
 * flipped sign under it: that pairs "you are gaining" with a caution color, or
 * drops a bullet off the end. So the tones, in order, gate the grace window.
 */
export function seasonInsightGuard(data: SeasonHeadlineData): string {
  return insightHash({ tones: data.bullets.map((b) => b.tone).join(',') })
}

export const SEASON_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach naming what an athlete season has actually done, in the card that opens their analytics page.',
    'one sentence tying the reads together into a single takeaway',
    SEASON_LIMITS
  ),
  `"bullets" is one line per read, in the order they are listed, each at most ${SEASON_LIMITS.bullet} characters.`,
  'A bullet says what its read means for the athlete, in the voice of a coach rather than a metric readout.',
  'Keep the figures the read is built on, and keep the period they cover: a pace measured over the first weeks of the season is an average of that block, never a single run, so never phrase it as one.',
  'The body must not repeat the bullets: it is what they add up to.',
].join(' ')

export function seasonInsightPrompt(data: SeasonHeadlineData, recentHeadlines: string[]): string {
  return [
    'Reads from this season so far, each tagged with whether it is a gain or a concern:',
    ...data.bullets.map((b) => `- (${b.tone}) ${b.text}`),
    avoidClause(recentHeadlines),
  ].join('\n')
}
