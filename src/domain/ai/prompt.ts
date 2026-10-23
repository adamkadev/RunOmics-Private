import { activeLocale } from '@/i18n'

/**
 * Part of every single-card surface's hash: bump it with a change to their prompts or the shared rules below,
 * so each card is written again. Run verdicts carry their own (RUN_VERDICT_PROMPT_VERSION).
 */
export const CARD_PROMPT_VERSION = 4

/** Folded into prompt versions on a French build only, so tightening the French rules spends no English deployment's daily budget. */
const FRENCH_RULES_VERSION = 1

export function promptVersion(version: number): number | string {
  return activeLocale === 'fr' ? `${version}-fr${FRENCH_RULES_VERSION}` : version
}

/** The facts and rules are English, so the model carries their phrasing over word for word; it is never told the athlete's gender. */
const FRENCH_RULES = [
  'Write in French, tutoiement, as a French-speaking running coach would say it out loud: never as a translation of the English facts and rules you are given.',
  'Use the words French runners use (footing, sortie longue, endurance, fractionné, séance au seuil, allure, récup) and never carry an English turn of phrase over word for word: no « garder le facile facile », « faire compter », « payer » for a benefit, « construire de la condition ».',
  "You are not told the athlete's gender, so no adjective or past participle may agree with the athlete: write « tes jambes sont fraîches », « la fatigue est retombée », « la séance est faite », never « tu es frais », « tu es fatiguée » or « tu t'es entraîné ».",
  "Keep correct orthography: every accent (é, è, à, ê, ç...) and every elision apostrophe (l'effort, d'un, qu'il, s'est) - never drop them. Put a space before « : », « ; », « ! » and « ? », as French does.",
].join(' ')

export interface Limits {
  headline: number
  body: number
  bullet?: number
}

export function systemInstruction(role: string, bodySpec: string, limits: Limits): string {
  return [
    role,
    activeLocale === 'fr' ? FRENCH_RULES : 'Write in English, second person.',
    `"headline" is the verdict: at most ${limits.headline} characters, punchy, no emoji.`,
    `"body" is ${bodySpec}: at most ${limits.body} characters.`,
    'Never use the em-dash character. Never invent data that is not in the facts.',
    'Always write numbers as digits, never spelled out in words - "30°", "12 km", "45 min", not "thirty degrees" or "trente degrés".',
    'Round any distance you mention to whole kilometres: "13 km", never "13.2 km".',
    'Form, fitness, fatigue and training effect are internal index values: never quote one back, say what it means for the athlete instead.',
    'The headline and the body are read together: never repeat a number, a fact or a turn of phrase between them.',
  ].join(' ')
}

/** Another run's lead fact is avoided only while this run has another: a ban leaves no angle once many verdicts are shown. */
export function avoidClause(recent: string[], source: 'thisCard' | 'otherRuns' = 'thisCard'): string {
  if (recent.length === 0) return ''
  const quoted = recent.map((line) => `"${line}"`).join(', ')
  return source === 'thisCard'
    ? `\nHeadlines this card has shown before, whose phrasing and sentence shape you must not reuse: ${quoted}.`
    : `\nVerdicts already written for other runs, those of the same kind of session first: yours must not read like any of them. Never reuse their wording, their opening words or their sentence shape, and lead on another fact unless this run's facts leave no other: ${quoted}.`
}
