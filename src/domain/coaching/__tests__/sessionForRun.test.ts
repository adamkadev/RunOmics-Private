import { describe, expect, it } from 'vitest'
import type { WorkoutPrescription } from '../types'
import { sessionForRun } from '../sessionForRun'

const at = (date: string, type: string, extra: object = {}) =>
  ({ prescription: { id: `${date}-${type}`, date, type, status: 'planned', ...extra } as unknown as WorkoutPrescription, activityId: null as string | null })
const run = { id: 'run-1', date: '2026-10-06T07:00:00', type: 'Tempo' as const }

describe('sessionForRun', () => {
  it('takes the session the coach matched the run to', () => {
    const matched = { ...at('2026-10-01', 'tempo'), activityId: 'run-1' }
    expect(sessionForRun(run, [at('2026-10-06', 'threshold'), matched])).toBe(matched.prescription)
  })

  it('takes the day\'s session the run is named after', () => {
    const hills = at('2026-10-06', 'easy', { title: 'Easy · 40 min + 8 × 10″' })
    const named = { ...run, type: 'Base' as const, description: 'Easy · 40 min + 8 × 10"' }
    expect(sessionForRun(named, [at('2026-10-06', 'easy', { title: 'Easy run' }), hills])).toBe(hills.prescription)
  })

  it('else the day\'s one session of the run\'s type, then of its family', () => {
    const tempo = at('2026-10-06', 'tempo')
    expect(sessionForRun(run, [at('2026-10-06', 'threshold'), tempo])).toBe(tempo.prescription)
    const threshold = at('2026-10-06', 'threshold')
    expect(sessionForRun(run, [at('2026-10-05', 'easy'), threshold])).toBe(threshold.prescription)
    const easy = at('2026-10-06', 'easy')
    expect(sessionForRun({ ...run, type: 'Base' }, [easy])).toBe(easy.prescription)
  })

  it('takes none for an easy run on a hard day, a cancelled session, or a day of two alike', () => {
    expect(sessionForRun({ ...run, type: 'Base' }, [at('2026-10-06', 'threshold')])).toBeNull()
    expect(sessionForRun(run, [at('2026-10-06', 'threshold', { status: 'cancelled' })])).toBeNull()
    expect(sessionForRun(run, [at('2026-10-06', 'easy')])).toBeNull()
    expect(sessionForRun(run, [at('2026-10-06', 'threshold'), at('2026-10-06', 'vo2max')])).toBeNull()
  })

  it('gives a run RunOmics typed its day\'s only session whatever its kind', () => {
    const easy = at('2026-10-06', 'easy')
    expect(sessionForRun({ ...run, typeSource: 'runomics' }, [easy])).toBe(easy.prescription)
  })
})
