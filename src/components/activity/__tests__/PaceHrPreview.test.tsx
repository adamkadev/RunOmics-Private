import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { PaceHrPreview } from '../PaceHrPreview'

const ys = (d: string) => [...d.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]))

describe('PaceHrPreview', () => {
  // Drawn over each other, the two lines tangle.
  it('draws pace and heart rate in lanes of their own, pace above', () => {
    render(<PaceHrPreview paceSamples={[300, 290, 310, 305]} hrSamples={[130, 150, 145, 160]} distanceKm={11.51} />)

    const pace = ys(screen.getByTestId('preview-pace').getAttribute('d')!)
    const hr = ys(screen.getByTestId('preview-hr').getAttribute('d')!)
    expect(Math.max(...pace)).toBeLessThan(Math.min(...hr))
  })

  it('labels where the lines start and end', () => {
    render(<PaceHrPreview paceSamples={[300, 290, 310]} hrSamples={null} distanceKm={11.51} />)

    const ends = screen.getByTestId('preview-ends')
    expect(ends.children[0]!.textContent).toBe(t.activity.pacePreview.start)
    expect(ends.children[1]!.textContent).toBe(`11.5 ${t.units.km}`)
  })
})
