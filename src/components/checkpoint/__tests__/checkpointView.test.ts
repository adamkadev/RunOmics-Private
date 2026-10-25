import { describe, expect, it } from 'vitest'
import type { CycleCheckpoint } from '@/application/usecases/GetCycleCheckpoint'
import { checkpointCycle } from '@/domain/training/cycleCheckpoint'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'
import { checkpointView } from '../checkpointView'

const DATA: CycleCheckpoint = {
  cycle: checkpointCycle('2026-10-15', '2026-11-04'),
  generalPreparation: true,
  volume: { kmPerWeek: { previous: 34.3, current: 44.8 }, runsPerWeek: { previous: 4, current: 5 } },
  threshold: null,
  efficiency: { previous: 1.16, current: 1.16 },
  easyHr: { paceSecPerKm: 350, previous: 148, current: 145 },
  fiveK: { previous: { date: '2026-09-05', seconds: 1_260, vdot: 47 }, current: null },
  vo2max: null,
  thresholdPace: { previous: { date: '2026-10-10', value: 261 }, current: { date: '2026-10-10', value: 261 } },
  lthr: { previous: { date: '2026-09-29', value: 183 }, current: { date: '2026-10-10', value: 179 } },
  restingHr: { previous: null, current: 55.9 },
  ctl: null,
}

describe('checkpointView', () => {
  const view = checkpointView(DATA, '2026-11-04')
  const rows = Object.fromEntries(view.sections.flatMap((section) => section.rows).map((row) => [row.key, row]))

  it('reads each delta by which way is better, lower heart rate included', () => {
    expect(rows.distance!.tone).toBe('good')
    expect(rows.easyHr).toMatchObject({ delta: '−3 bpm', direction: 'down', tone: 'good' })
    expect(rows.thresholdPace).toMatchObject({ delta: '±0 s', tone: 'flat', note: t.checkpoint.lastReading(formatDate('2026-10-10', { style: 'bare' })) })
  })

  it('counts only the scored rows with both cycles, and says what is missing', () => {
    expect(view.summary).toEqual({ good: 3, worse: 0, flat: 2 })
    expect(rows.lthr).toMatchObject({ delta: '−4 bpm', scored: false })
    expect(rows.fiveK).toMatchObject({ current: null, previous: '21:00', missing: t.checkpoint.noCheck })
    expect(rows.restingHr!.missing).toBe(t.checkpoint.nothingBefore)
  })
})
