import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { tooltipNumber } from '@/components/ui/ChartTooltip'
import { heatAdjustedEf } from '@/domain/activity/heat'

describe('chart guards (G07)', () => {
  it('never prints NaN in a tooltip', () => {
    for (const value of [NaN, Infinity, null, undefined]) {
      expect(tooltipNumber(value, (v) => v.toFixed(2))).toBe('—')
    }
    expect(tooltipNumber(2.891, (v) => v.toFixed(2))).toBe('2.89')
  })

  it('keeps a run without a temperature as measured instead of NaN', () => {
    expect(heatAdjustedEf(2.9, { apparentTempC: undefined } as never)).toBe(2.9)
    expect(Number.isFinite(heatAdjustedEf(2.9, { apparentTempC: NaN } as never))).toBe(true)
  })

  it('renders no NaN anywhere in a tooltip row', async () => {
    const { TooltipRow } = await import('@/components/ui/ChartTooltip')
    const { container } = render(<TooltipRow name="Heat-adjusted" value={tooltipNumber(NaN, (v) => v.toFixed(2))} />)
    expect(container.textContent).not.toContain('NaN')
  })
})
