import { activeLocale } from '@/i18n'

export interface Limits {
  headline: number
  body: number
  /** Only for surfaces that ask the model to phrase their reads as bullets. */
  bullet?: number
}

// Shared by every surface: the same voice, the same house style, the same
// refusal to invent numbers. Only the role line and the facts differ.
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
    // Decimals and index values are how the copy stops sounding like a coach and
    // starts sounding like the database it was built from.
    'Round any distance you mention to whole kilometres: "13 km", never "13.2 km".',
    'Form, fitness, fatigue and training effect are internal index values: never quote one back, say what it means for the athlete instead.',
    'The headline and the body are read together: never repeat a number, a fact or a turn of phrase between them.',
  ].join(' ')
}

export function avoidClause(recentHeadlines: string[]): string {
  if (recentHeadlines.length === 0) return ''
  return `\nAvoid re-using the phrasing of these previous headlines: ${recentHeadlines
    .map((h) => `"${h}"`)
    .join(', ')}.`
}
