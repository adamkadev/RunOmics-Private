import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { UnitCoverage } from '@/domain/explore/types'
import { QuartierSheet } from '../QuartierSheet'

const unit = (pct: number): UnitCoverage => ({
  id: 'test-bravo',
  name: 'Bravo',
  kind: 'quartier',
  commune: 'Testville',
  label: [0, 0],
  visited: pct,
  total: 100,
  pct,
  state: pct >= 90 ? 'complete' : 'partly',
  kmRun: 12,
  lastRunDate: '2026-10-21',
  distanceKm: 1.2,
})

describe('QuartierSheet', () => {
  it('says since when a complete quartier has been complete', () => {
    render(<QuartierSheet unit={unit(92)} completeSince="2026-05-12" onClose={() => {}} />)
    expect(screen.getByTestId('quartier-complete-note').textContent).toMatch(/^Complete since May 12/)
  })

  it('keeps the 90 % mark while the shown runs leave it short, whatever the server says', () => {
    render(<QuartierSheet unit={unit(85)} completeSince="2026-05-12" onClose={() => {}} />)
    expect(screen.getByTestId('quartier-complete-note').textContent).toBe('Complete at 90%')
  })
})
