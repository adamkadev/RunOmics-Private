import { activeLocale } from '@/i18n'

/**
 * Part of the hash of every single-card surface (Today, PB celebration, shoe
 * verdict): bump it with a change to their prompts or the shared rules below,
 * and each card is written again on the next pass instead of keeping copy
 * from the old prompt. Run verdicts carry their own (RUN_VERDICT_PROMPT_VERSION).
 */
export const CARD_PROMPT_VERSION = 2

export interface Limits {
  headline: number
  body: number
  bullet?: number
}

export function systemInstruction(role: string, bodySpec: string, limits: Limits): string {
  return [
    role,
    activeLocale === 'fr'
      ? "Write in French, tutoiement, with correct orthography: keep every accent (é, è, à, ê, ç...) and every elision apostrophe (l'effort, d'un, qu'il, s'est) - never drop them."
      : 'Write in English, second person.',
    `"headline" is the verdict: at most ${limits.headline} characters, punchy, no emoji.`,
    `"body" is ${bodySpec}: at most ${limits.body} characters.`,
    'Never use the em-dash character. Never invent data that is not in the facts.',
    'Always write numbers as digits, never spelled out in words - "30°", "12 km", "45 min", not "thirty degrees" or "trente degrés".',
    'Round any distance you mention to whole kilometres: "13 km", never "13.2 km".',
    'Form, fitness, fatigue and training effect are internal index values: never quote one back, say what it means for the athlete instead.',
    'The headline and the body are read together: never repeat a number, a fact or a turn of phrase between them.',
  ].join(' ')
}

/**
 * What the model must not repeat (v4.16.4). A card's own earlier headlines
 * are its history, which it should not echo; other runs' verdicts are cards
 * around it, whose wording it must not reuse - but banning their angle too
 * left no angle once a backfill had written thirty of them.
 */
export function avoidClause(recent: string[], source: 'thisCard' | 'otherRuns' = 'thisCard'): string {
  if (recent.length === 0) return ''
  const quoted = recent.map((line) => `"${line}"`).join(', ')
  return source === 'thisCard'
    ? `\nHeadlines this card has shown before, whose phrasing and sentence shape you must not reuse: ${quoted}.`
    : `\nVerdicts already written for other runs: never reuse their wording or open the same way, though the same angle is fine when this run's facts call for it: ${quoted}.`
}
