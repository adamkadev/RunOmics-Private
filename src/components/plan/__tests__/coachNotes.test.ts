import { describe, expect, it } from 'vitest'
import type { CoachWords } from '@/application/coaching/GetCoachWords'
import { t } from '@/i18n'
import { coachNotesFor } from '../coachNotes'

const WORDS: CoachWords = {
  block: { name: 'Base', focus: '' },
  weeks: [{ startDate: '2026-10-26', endDate: '2026-11-01', focus: 'Toujours très lent.' }],
  sessions: {
    reps: {
      description: 'Course-marche.',
      notes: ['Course-marche.', 'Effort about 6/10.'],
      steps: [
        { kind: 'warmup', repeated: false, notes: ['Easy jogging.'] },
        { kind: 'effort', repeated: true, notes: ['Guide pace first.'] },
        { kind: 'effort', repeated: false, notes: ['Steady.'] },
        { kind: 'strides', repeated: true, notes: ['Relaxed.'] },
      ],
    },
    bare: { description: '', notes: [], steps: [] },
  },
}

describe('coachNotesFor', () => {
  it('reads the session once, each noted step under its name, and the week the session falls in', () => {
    const s = t.plan.coachNotes.step
    expect(coachNotesFor(WORDS, 'reps', '2026-10-30')).toEqual({
      session: ['Course-marche.', 'Effort about 6/10.'],
      steps: [
        { label: s.warmup, notes: ['Easy jogging.'] },
        { label: s.eachRep, notes: ['Guide pace first.'] },
        { label: s.main, notes: ['Steady.'] },
        { label: s.strides, notes: ['Relaxed.'] },
      ],
      week: 'Toujours très lent.',
    })
  })

  it('keeps a bare session’s week, and has nothing for one with no words at all', () => {
    expect(coachNotesFor(WORDS, 'bare', '2026-10-30')).toEqual({ session: [], steps: [], week: 'Toujours très lent.' })
    expect(coachNotesFor(WORDS, 'bare', '2026-11-04')).toBeNull()
  })

  it('leaves out a description that only repeats the title', () => {
    expect(coachNotesFor(WORDS, 'reps', '2026-10-30', 'Course-marche.')?.session).toEqual(['Effort about 6/10.'])
  })

  it('has nothing for a session the watch planned, or before the words arrive', () => {
    expect(coachNotesFor(WORDS, 'garmin:2026-10-30:Run', '2026-10-30')).toBeNull()
    expect(coachNotesFor(null, 'reps', '2026-10-30')).toBeNull()
  })
})
