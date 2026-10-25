import { CHECK_IN_SCORES, type CheckIn, type CheckInReading, type Niggle } from '@/domain/wellness/checkIn'
import { t } from '@/i18n'

export function niggleLabel(niggle: Pick<Niggle, 'site' | 'side'>): string {
  return t.wellness.niggleName(niggle.site, niggle.side ?? null)
}

/** "Sleep good · Soreness slight · Left calf 3/10 · Travelling". */
export function checkInSummary(entry: CheckIn): string {
  const w = t.wellness
  const parts = CHECK_IN_SCORES.flatMap((field) => {
    const value = entry[field]
    if (value === undefined) return []
    const score = w.checkIn.scores[field]
    return [`${score.label} ${score.words[value - 1]!.toLocaleLowerCase(t.locale)}`]
  })
  if (entry.niggle) parts.push(`${niggleLabel(entry.niggle)} ${w.pain(entry.niggle.pain)}`)
  if (entry.ill) parts.push(w.checkIn.flags.ill)
  if (entry.travel) parts.push(w.checkIn.flags.travel)
  return parts.join(' · ')
}

/** The gravest concern writes the card; the rest are the same advice or milder. */
export function concernCopy(reading: CheckInReading): { line: string; headline: string; body: string } {
  const r = t.wellness.readiness
  const lead = reading.concerns[0]!
  const line = r.line[reading.tone]
  if (lead.kind === 'ill') return { line, ...r.ill }
  if (lead.kind === 'sleepSoreness') return { line, ...r.sleepSoreness }
  const name = niggleLabel(lead.niggle)
  const pain = t.wellness.pain(lead.niggle.pain)
  return { line, ...(reading.tone === 'hold' ? r.painHold(name, pain) : r.painEase(name, pain)) }
}
