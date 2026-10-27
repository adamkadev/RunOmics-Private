import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CelebrationOverlay } from '@/components/dashboard/CelebrationOverlay'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { t } from '@/i18n'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const RECENT_RECORD: RecordEntry = {
  key: '5k',
  label: '5K',
  seconds: 1264,
  paceSecPerKm: 253,
  activityId: 'act-1',
  date: todayIso(),
  official: false,
}

describe('CelebrationOverlay', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders nothing without a record', () => {
    render(<CelebrationOverlay record={null} aiTake={null} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders nothing for a record older than the celebration window', () => {
    render(<CelebrationOverlay record={{ ...RECENT_RECORD, date: '2020-01-01' }} aiTake={null} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('celebrates a recent record and dismisses on Later', () => {
    render(<CelebrationOverlay record={RECENT_RECORD} aiTake={null} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/later/i))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names the dialog after what it celebrates and closes on Escape, remembered as seen', () => {
    render(<CelebrationOverlay record={RECENT_RECORD} aiTake={null} />)
    expect(screen.getByRole('dialog', { name: `${t.dashboard.celebration.eyebrow} 5K` })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.localStorage.getItem(`ro-celebration-seen:${RECENT_RECORD.activityId}-${RECENT_RECORD.key}`)).toBe('1')
  })

  it('does not re-show a record already marked seen', () => {
    window.localStorage.setItem(`ro-celebration-seen:${RECENT_RECORD.activityId}-${RECENT_RECORD.key}`, '1')
    render(<CelebrationOverlay record={RECENT_RECORD} aiTake={null} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('celebrates a milestone since the return, after the record it shares the days with', () => {
    const milestone = { key: 'continuous20' as const, date: todayIso(), activityId: 'act-2' }
    render(<CelebrationOverlay record={RECENT_RECORD} milestone={milestone} aiTake={null} />)
    fireEvent.click(screen.getByText(/later/i))

    expect(screen.getByRole('dialog')).toHaveTextContent('First 20 minutes non-stop')
    expect(screen.getByRole('link')).toHaveAttribute('href', '/activities/act-2')
    fireEvent.click(screen.getByText(/later/i))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.localStorage.getItem(`ro-celebration-seen:return-continuous20-${milestone.date}`)).toBe('1')
  })

  it('does not celebrate an old milestone since the return', () => {
    render(<CelebrationOverlay record={null} milestone={{ key: 'nonstop3k', date: '2020-01-01', activityId: null }} aiTake={null} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
