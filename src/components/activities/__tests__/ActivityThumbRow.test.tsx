import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ActivitySummary } from '@/domain/activity/types'
import { t } from '@/i18n'
import { formatDate } from '@/lib/formatters'
import { ActivityThumbRow, thumbRowMeta } from '../ActivityThumbRow'

vi.mock('next/navigation', async (actual) => ({ ...(await actual<typeof import('next/navigation')>()), useRouter: () => ({ prefetch: () => {} }) }))

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

describe('ActivityThumbRow', () => {
  const activity = {
    id: 'a1', date: '2026-10-20', dayOfWeek: 'Tuesday', type: 'Threshold', description: 'Threshold 2 × 7:00 - 2 × 7′', comment: '',
    distanceKm: 10.2, durationSeconds: 3443, paceSecPerKm: 337, avgHeartRate: 139, zones: [], routeThumb: null,
  } as ActivitySummary

  it('names the session by its set, its type left to the dot and to VoiceOver', () => {
    render(<ActivityThumbRow activity={activity} variant="inset" />)
    const row = screen.getByTestId('thumb-row')
    expect(screen.getByText(thumbRowMeta(activity, 'inset'))).toBeInTheDocument()
    expect(row.textContent).toContain('2 × 7′')
    expect(row.textContent).not.toContain('2 × 7:00')
    // On screen, no "Threshold"; read aloud, the type before the set.
    const spoken = screen.getByText('Threshold', { exact: false, selector: '.sr-only' })
    expect(spoken.nextSibling?.textContent ?? spoken.parentElement?.textContent).toContain('2 × 7′')
  })

  it("shows the session's type where it is not the watch's", () => {
    render(<ActivityThumbRow activity={{ ...activity, type: 'Tempo' }} type="Threshold" variant="inset" />)
    expect(screen.getByText('Threshold', { exact: false, selector: '.sr-only' })).toBeInTheDocument()
    expect(screen.queryByText('Tempo', { exact: false, selector: '.sr-only' })).toBeNull()
  })

  it('keeps a name with no set whole', () => {
    render(<ActivityThumbRow activity={{ ...activity, type: 'Base', description: 'Long run' }} variant="inset" />)
    expect(screen.getByTestId('thumb-row').textContent).toContain('Long run')
  })
})
