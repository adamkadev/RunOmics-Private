import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { ChartFigure } from '@/components/ui/ChartFigure'

describe('ChartFigure', () => {
  it('exposes the summary as an accessible image with the chart content hidden', () => {
    render(
      <ChartFigure summary="Weekly volume: 20.0–45.0 km">
        <svg data-testid="chart-svg" />
      </ChartFigure>
    )

    const figure = screen.getByRole('img', { name: 'Weekly volume: 20.0–45.0 km' })
    expect(figure).toBeInTheDocument()

    const svg = screen.getByTestId('chart-svg')
    expect(svg.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('has no axe violations', async () => {
    const { container } = render(
      <ChartFigure summary="Heart rate: avg 150, max 172 bpm">
        <svg />
      </ChartFigure>
    )
    const results = await axe.run(container)
    expect(results.violations).toEqual([])
  })
})
