import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EasyHardChart } from '../EasyHardChart'
import { t } from '@/i18n'

const month = (label: string, easyPct: number) => ({ month: label, label, easyPct, hardPct: 100 - easyPct })

describe('EasyHardChart', () => {
  // G09: it printed the mean of the monthly shares (47 %) while the pooled
  // time, which every other screen shows, was 24 %.
  it('reads the easy time it is given, not a mean of the months', () => {
    render(<EasyHardChart data={[month('Jan', 70), month('Feb', 24)]} share={{ easy: 24, hard: 76 }} />)
    expect(screen.getByText(t.analytics.charts.easyHard.explains.tooHard(24))).toBeTruthy()
    expect(screen.getByText(t.analytics.charts.easyHard.title)).toBeTruthy()
  })

  it('renders nothing without easy time', () => {
    const { container } = render(<EasyHardChart data={[month('Jan', 70)]} share={null} />)
    expect(container.firstChild).toBeNull()
  })
})
