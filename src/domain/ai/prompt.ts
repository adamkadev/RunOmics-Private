import { activeLocale } from '@/i18n'

export interface Limits {
  headline: number
  body: number
}

// Shared by every surface: the same voice, the same house style, the same
// refusal to invent numbers. Only the role line and the facts differ.
export function systemInstruction(role: string, bodySpec: string, limits: Limits): string {
  return [
    role,
    activeLocale === 'fr' ? 'Write in French, tutoiement.' : 'Write in English, second person.',
    `"headline" is the verdict: at most ${limits.headline} characters, punchy, no emoji.`,
    `"body" is ${bodySpec}: at most ${limits.body} characters.`,
    'Never use the em-dash character. Never invent data that is not in the facts.',
  ].join(' ')
}

export function avoidClause(recentHeadlines: string[]): string {
  if (recentHeadlines.length === 0) return ''
  return `\nAvoid re-using the phrasing of these previous headlines: ${recentHeadlines
    .map((h) => `"${h}"`)
    .join(', ')}.`
}
