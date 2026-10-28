import type { CoachStepWords, CoachWords } from '@/application/coaching/GetCoachWords'
import { t } from '@/i18n'

export interface CoachNoteStep {
  label: string
  notes: string[]
}

export interface CoachNotes {
  session: string[]
  steps: CoachNoteStep[]
  week: string | null
}

function stepLabel(step: CoachStepWords): string {
  const s = t.plan.coachNotes.step
  if (step.kind === 'effort') return step.repeated ? s.eachRep : s.main
  return s[step.kind]
}

/** A session the watch planned has no words; one whose words are all empty gets no button. A description that only repeats the title says nothing the card does not. */
export function coachNotesFor(words: CoachWords | null, key: string, date: string, title = ''): CoachNotes | null {
  const session = words?.sessions[key]
  if (!words || !session) return null
  const lines = [...new Set([session.description, ...session.notes].filter((line) => line && line !== title))]
  const steps = (session.steps ?? []).map((step) => ({ label: stepLabel(step), notes: step.notes }))
  const week = words.weeks.find((candidate) => candidate.startDate <= date && date <= candidate.endDate)?.focus || null
  return lines.length || steps.length || week ? { session: lines, steps, week } : null
}
