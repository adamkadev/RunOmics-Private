import type { WeeklyDigest } from '@/application/usecases/GetWeeklyDigest'
import { insightHash } from './insightHash'
import { avoidClause, systemInstruction } from './prompt'

export const WEEKLY_REVIEW_SURFACE = 'weeklyReview'
export const WEEKLY_REVIEW_LIMITS = { headline: 56, body: 150 }

function facts(digest: WeeklyDigest) {
  return {
    week: digest.totals.weekNumber,
    km: digest.totals.distanceKm,
    sessions: digest.totals.sessions,
    hardPct: digest.totals.hardPct,
    daysLeft: digest.remainder.days,
    plannedLeft: digest.remainder.plannedSessions,
    lastWeekKm: digest.lastWeek?.distanceKm ?? null,
    lastWeekSessions: digest.lastWeek?.sessions ?? null,
    ...Object.fromEntries(digest.review.map((fact, i) => [`fact${i}`, `${fact.severity}:${fact.text}`])),
  }
}

export function weeklyReviewInsightHash(digest: WeeklyDigest): string {
  return insightHash(facts(digest))
}

export const WEEKLY_REVIEW_SYSTEM_INSTRUCTION = [
  systemInstruction(
    'You are a running coach writing the review of the week in progress, on an athlete dashboard.',
    'one sentence on what the week amounts to and what it asks of the days left in it',
    WEEKLY_REVIEW_LIMITS
  ),
  // The reads are printed as bullets right below, and the distance sits in the
  // ring above them: repeating either wastes the only two lines available.
  'The individual reads are listed as bullets under your text, so do not restate them one by one.',
  'The distance and the session count are already printed in the card above yours: never state them, in the headline or in the body.',
  'Judge the week as a whole. Never invent a session, a race or a plan that is not in the facts.',
  // Half the value of reading this mid-week is knowing what the days left are for.
  'The week is not over: say what the days left in it are for, and count only the sessions the plan actually holds.',
].join(' ')

export function weeklyReviewInsightPrompt(digest: WeeklyDigest, recentHeadlines: string[]): string {
  const { totals, review, remainder, lastWeek } = digest

  return [
    `The week so far: ${totals.distanceKm} km over ${totals.sessions} session${totals.sessions === 1 ? '' : 's'}.`,
    totals.hardPct !== null ? `Share of hard running: ${Math.round(totals.hardPct)}%.` : null,
    lastWeek ? `Last week finished on ${lastWeek.distanceKm} km over ${lastWeek.sessions} sessions.` : null,
    `${remainder.days} day${remainder.days === 1 ? '' : 's'} left in the week, today included, holding ${remainder.plannedSessions} planned session${remainder.plannedSessions === 1 ? '' : 's'} not yet run.`,
    review.length ? '' : null,
    review.length ? 'Reads from this week, each tagged with whether it is a gain or a concern:' : null,
    ...review.map((fact) => `- (${fact.severity}) ${fact.text}`),
    avoidClause(recentHeadlines),
  ]
    .filter((line) => line !== null)
    .join('\n')
}
