import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadRiskPanel } from '../LoadRiskPanel'
import type { LoadRiskPanel as Data } from '@/application/usecases/GetLoadRiskPanel'
import { t } from '@/i18n'

const DATA: Data = {
  acwr: 1.4, acute: 412, chronic: 295, acwrZone: 'caution', acwrSource: 'garmin',
  monotony: 0.4, monotonyZone: 'safe', strain: 120, strainZone: 'caution',
  rampRate: -1.5, rampRateZone: 'safe', daysOfHistory: 200,
}

describe('LoadRiskPanel', () => {
  // G02: ACWR 0.8 sat under Acute 412 and Chronic 295.
  it('prints the ratio with the pair it comes from, and names its model', () => {
    render(<LoadRiskPanel data={DATA} />)
    expect(screen.getByText(t.loadRisk.acwr.inputs(412, 295))).toBeInTheDocument()
    expect(screen.getByText('1.40')).toBeInTheDocument()
    expect(screen.getByText(`· ${t.analytics.model.garmin}`)).toBeInTheDocument()
    expect(screen.getByText(t.loadRisk.summary.flagged(1, 3, t.loadRisk.band.caution))).toBeInTheDocument()
  })
})
