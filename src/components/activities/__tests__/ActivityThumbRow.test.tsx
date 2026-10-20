import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ActivitySummary } from '@/domain/activity/types'
import { t } from '@/i18n'
import { splitStructuredTitle } from '@/lib/activityTitle'
import { formatDate } from '@/lib/formatters'
import { ActivityThumbRow, thumbRowMeta } from '../ActivityThumbRow'

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

// 3.0.2: a structured name truncated on its one line; the session's name
// stays there, its structure leads the second.
describe('splitStructuredTitle', () => {
  it('splits a name from the structure it carries', () => {
    expect(splitStructuredTitle('Threshold 2 × 7:00 - 2 × 7′')).toEqual({ name: 'Threshold', structure: '2 × 7:00 - 2 × 7′' })
    expect(splitStructuredTitle('Threshold · 3 × 8′ @ 4:25')).toEqual({ name: 'Threshold', structure: '3 × 8′ @ 4:25' })
    expect(splitStructuredTitle("Répétitions allure d'objectif - 4x3'@4:24")).toEqual({ name: "Répétitions allure d'objectif", structure: "4x3'@4:24" })
  })

  it('keeps a plain name whole', () => {
    for (const title of ['Easy Run', '5K Race', 'Morning Run 10 km', 'VO2 max 5x3′', 'Sunday Run']) {
      expect(splitStructuredTitle(title)).toEqual({ name: title, structure: null })
    }
  })
})

describe('ActivityThumbRow', () => {
  const activity = {
    id: 'a1', date: '2026-10-20', dayOfWeek: 'Tuesday', type: 'Threshold', description: 'Threshold 2 × 7:00 - 2 × 7′', comment: '',
    distanceKm: 10.2, durationSeconds: 3443, paceSecPerKm: 337, avgHeartRate: 139, rpe: null, hrZones: [], week: 0, elevationGain: null, routeThumb: null,
  } as ActivitySummary

  // App Fixes 3d: the date leads the meta line, the structure follows it,
  // so a long structure is what a narrow row ellipses - never the date.
  it('names the session on the first line and leads the meta with the date', () => {
    render(<ActivityThumbRow activity={activity} variant="inset" />)
    const row = screen.getByTestId('thumb-row')
    expect(screen.getByText('Threshold')).toBeInTheDocument()
    expect(screen.getByText(`${thumbRowMeta(activity, 'inset')} · 2 × 7:00 - 2 × 7′`)).toBeInTheDocument()
    expect(row.textContent).not.toContain('Threshold 2 ×')
  })
})
