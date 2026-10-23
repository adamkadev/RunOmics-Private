import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UnitCoverage } from '@/domain/explore/types'
import { t } from '@/i18n'
import { formatDate } from '@/lib/formatters'
import { QuartierSheet, lastRunLabel } from '../QuartierSheet'

const s = t.pages.map.districts.sheet

const UNIT: UnitCoverage = {
  id: 'test-bravo',
  name: 'Bravo',
  kind: 'quartier',
  commune: 'Testville',
  label: [-149.99, 45.001],
  visited: 12,
  total: 150,
  pct: 8,
  state: 'fog',
  kmRun: 2.4,
  lastRunDate: '2026-08-14',
  distanceKm: 1.9,
}

const sheet = () => screen.getByTestId('quartier-sheet')

describe('QuartierSheet', () => {
  afterEach(cleanup)

  it('names the quartier and its commune, in a dialog labelled by the name', () => {
    render(<QuartierSheet unit={UNIT} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Bravo' })
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Bravo' })).toBeInTheDocument()
    expect(within(dialog).getByText('Quartier · Testville')).toBeInTheDocument()
  })

  it('calls a commune a commune', () => {
    render(<QuartierSheet unit={{ ...UNIT, kind: 'commune', name: 'Woodtown', commune: 'Woodtown' }} onClose={() => {}} />)
    expect(screen.getByText(s.commune)).toBeInTheDocument()
    expect(screen.queryByText(/^Quartier ·/)).toBeNull()
  })

  it('says how much is explored, in cells, against the 90% that completes it', () => {
    render(<QuartierSheet unit={UNIT} onClose={() => {}} />)
    expect(screen.getByText('8% explored')).toBeInTheDocument()
    expect(screen.getByText('12 of 150 cells')).toBeInTheDocument()
    expect(screen.getByTestId('quartier-progress')).toHaveStyle({ width: '8%' })
    // The tick at 90%, and the line that says what it is.
    expect(screen.getByTestId('quartier-complete-tick')).toHaveStyle({ left: '90%' })
    expect(screen.getByText('Complete at 90%')).toBeInTheDocument()
  })

  it('counts one cell as one', () => {
    render(<QuartierSheet unit={{ ...UNIT, visited: 1, total: 1, pct: 100 }} onClose={() => {}} />)
    expect(screen.getByText('1 of 1 cell')).toBeInTheDocument()
    expect(screen.getByTestId('quartier-progress')).toHaveStyle({ width: '100%' })
  })

  it('shows the run here, the last run and the distance from home', () => {
    render(<QuartierSheet unit={UNIT} onClose={() => {}} />)
    const stats = within(sheet())
    expect(stats.getByText('2.4 km')).toBeInTheDocument()
    expect(stats.getByText(s.runHere)).toBeInTheDocument()
    expect(stats.getByText(lastRunLabel('2026-08-14'))).toBeInTheDocument()
    expect(stats.getByText(s.lastRun)).toBeInTheDocument()
    expect(stats.getByText('1.9 km')).toBeInTheDocument()
    expect(stats.getByText(s.fromHome)).toBeInTheDocument()
  })

  it('keeps a value’s number and unit on one line, the values at 30 pt and 8 pt apart', () => {
    render(<QuartierSheet unit={{ ...UNIT, kmRun: 10.9 }} onClose={() => {}} />)
    const value = within(sheet()).getByText('10.9 km')
    // A no-break space: at 320 pt "10.9" over "km" took two lines.
    expect(value.textContent).toBe('10.9\u00a0km')
    expect(value).toHaveStyle({ lineHeight: '30px' })
    expect(value.parentElement!.parentElement).toHaveClass('gap-2')
    expect(value.parentElement!.parentElement).not.toHaveClass('gap-4')
  })

  it('dashes what it doesn’t know: never run there, no home', () => {
    render(<QuartierSheet unit={{ ...UNIT, visited: 0, pct: 0, kmRun: 0, lastRunDate: null, distanceKm: null }} onClose={() => {}} />)
    expect(within(sheet()).getAllByText('—')).toHaveLength(3)
  })

  it('writes the last run as a day this year, a month and year before', () => {
    const now = new Date('2026-10-23T12:00:00')
    expect(lastRunLabel('2026-08-14', now)).toBe(formatDate('2026-08-14', { style: 'bare', year: 'never' }))
    expect(lastRunLabel('2026-08-14', now)).toBe('Aug 14')
    expect(lastRunLabel('2025-08-14', now)).toBe('Aug 2025')
  })

  it('closes from its own X, on the right of the name', async () => {
    const onClose = vi.fn()
    render(<QuartierSheet unit={UNIT} onClose={onClose} />)
    const close = screen.getByRole('button', { name: t.common.close })
    // The header is the sheet's own: the name first, close after it.
    expect(screen.getByRole('heading', { level: 2 }).compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('button', { name: t.common.close })).toHaveLength(1)
    fireEvent.click(close)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('has no Plan a run button until there is a way to plan one', () => {
    render(<QuartierSheet unit={UNIT} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: s.planRunHere })).toBeNull()
  })

  it('plans a run in this quartier when it can', () => {
    const onPlanRun = vi.fn()
    render(<QuartierSheet unit={UNIT} onClose={() => {}} onPlanRun={onPlanRun} />)
    fireEvent.click(screen.getByRole('button', { name: s.planRunHere }))
    expect(onPlanRun).toHaveBeenCalledWith('test-bravo')
  })
})
