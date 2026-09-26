import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { BestEfforts } from '../BestEfforts'

describe('BestEfforts', () => {
  const remichDeviceEfforts = { '5k': 1237.6 }
  const ingDeviceEfforts = { half: 5858.8, '10k': 2677.9 }

  it('still shows the device 5K effort when the certified PB is slower', () => {
    render(<BestEfforts bestEfforts={remichDeviceEfforts} qualifiedEfforts={[]} />)
    expect(screen.getByText('20:38')).toBeInTheDocument()
  })

  it('does not call that device effort a PR', () => {
    render(<BestEfforts bestEfforts={remichDeviceEfforts} qualifiedEfforts={[]} />)
    expect(screen.queryByText('PR')).not.toBeInTheDocument()
  })

  it('shows the device half effort without a PR badge either', () => {
    render(<BestEfforts bestEfforts={ingDeviceEfforts} qualifiedEfforts={[]} />)

    expect(screen.getByText('1:37:39')).toBeInTheDocument()
    expect(screen.queryByText('PR')).not.toBeInTheDocument()
  })

  it('still badges an effort that genuinely qualifies', () => {
    const qualified: QualifiedEffort[] = [{ key: '5k', label: '5K', rank: 1 }]
    render(<BestEfforts bestEfforts={remichDeviceEfforts} qualifiedEfforts={qualified} />)

    expect(screen.getByText('20:38')).toBeInTheDocument()
    expect(screen.getByText('PR')).toBeInTheDocument()
  })

  // G23: a grid, not a strip that cut the 5K off; the 1K time is its own pace.
  it('lays efforts out in two columns and gives the 1K no pace', () => {
    render(<BestEfforts bestEfforts={{ '1k': 223, '5k': 1205 }} qualifiedEfforts={[]} />)

    expect(screen.getByTestId('best-efforts').className).toContain('grid-cols-2')
    expect(screen.getAllByText(/\/km/)).toHaveLength(1)
  })
})

