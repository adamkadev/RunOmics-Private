import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimilarRunsChart, paceTicks, type SimilarRunPoint } from '../SimilarRunsChart'
import { formatPace } from '@/lib/formatters'

const runs: SimilarRunPoint[] = [
  { id: 'a', label: 'Mar 2, 2025', pace: 330, isCurrent: false },
  { id: 'b', label: 'Jun 8, 2025', pace: 300, isCurrent: false },
  { id: 'c', label: 'Oct 4, 2026', pace: 315, isCurrent: true },
]

function draw(onSelect = vi.fn()) {
  render(<SimilarRunsChart data={runs} bestPace={300} onSelect={onSelect} />)
  const plot = screen.getByTestId('similar-runs-plot')
  plot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 90 }) as DOMRect
  return { plot, onSelect }
}

describe('SimilarRunsChart', () => {
  it('ticks the pace axis at a readable step around every run', () => {
    expect(paceTicks([300, 315, 330])).toEqual([285, 300, 315, 330, 345])
  })

  it("reads a run's date and pace under the finger, and opens the run tapped", () => {
    const { plot, onSelect } = draw()
    expect(screen.getAllByTestId('similar-run-dot')).toHaveLength(3)

    const fastest = screen.getAllByTestId('similar-run-dot')[1]!
    const top = parseFloat(fastest.style.top)
    fireEvent.pointerDown(plot, { clientX: 101, clientY: top + 2, pointerType: 'touch' })
    const tooltip = screen.getByTestId('similar-runs-tooltip')
    expect(within(tooltip).getByText('Jun 8, 2025')).toBeInTheDocument()
    expect(within(tooltip).getByText(formatPace(300))).toBeInTheDocument()

    fireEvent.click(plot, { clientX: 101, clientY: top + 2 })
    expect(onSelect).toHaveBeenCalledWith('b')
    fireEvent.click(plot, { clientX: 199, clientY: 0 })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
