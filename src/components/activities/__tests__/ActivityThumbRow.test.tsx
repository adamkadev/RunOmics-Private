import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { formatDate } from '@/lib/formatters'
import { thumbRowMeta } from '../ActivityThumbRow'

// Design review, Oct 2026: date · moving time · avg HR, the type left to the dot.
describe('thumbRowMeta', () => {
  const run = { date: '2026-10-20', durationSeconds: 3443, avgHeartRate: 139 }

  it('reads the weekday and day, the moving time and the average HR in a week', () => {
    expect(thumbRowMeta(run, 'inset')).toBe(`Tue 20 · 57:23 · 139 ${t.units.bpm}`)
  })

  it('drops the HR when the run has none', () => {
    expect(thumbRowMeta({ ...run, avgHeartRate: null }, 'inset')).toBe('Tue 20 · 57:23')
  })

  it('keeps the month on a row outside its week, and an hour when there is one', () => {
    expect(thumbRowMeta({ ...run, durationSeconds: 5025 }, 'card')).toBe(`${formatDate('2026-10-20')} · 1:23:45 · 139 ${t.units.bpm}`)
  })
})
