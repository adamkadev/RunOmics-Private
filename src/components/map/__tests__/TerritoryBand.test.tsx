import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TerritoryBand, type TerritoryCardContent } from '../TerritoryBand'

const HEAT: TerritoryCardContent = {
  eyebrow: 'METZ · ALL YEARS',
  headline: { lead: '50% of your running is here. Half your runs stay inside the ', accent: '2.1 km ring', tail: ' around home.' },
  stats: [
    { label: 'Runs', value: '153' },
    { label: 'Distance', value: '1,327', unit: 'km' },
    { label: 'Median reach', value: '2.1', unit: 'km' },
  ],
}

describe('TerritoryBand', () => {
  it('draws the heat card as before: no button', () => {
    render(<TerritoryBand {...HEAT} />)
    const card = screen.getByTestId('territory-card')
    expect(card).toHaveTextContent('50% of your running is here.')
    expect(card.querySelector('button')).toBeNull()
  })

  it('puts an action under the stats, full width, when the content has one', () => {
    const onClick = vi.fn()
    render(<TerritoryBand {...HEAT} action={{ label: 'Plan a run in Nouvelle Ville', onClick }} />)
    const button = screen.getByRole('button', { name: 'Plan a run in Nouvelle Ville' })
    expect(button).toHaveClass('w-full', 'h-[50px]')
    // After the stats: the last thing in the card.
    expect(screen.getByTestId('territory-card').lastElementChild).toBe(button)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('holds two lines for a pending headline, so a one-line stand-in doesn’t shrink the card', () => {
    const { rerender } = render(<TerritoryBand {...HEAT} />)
    const headline = () => screen.getByText('50% of your running is here.', { exact: false })
    expect(headline()).not.toHaveClass('min-h-[2lh]')
    expect(screen.getByTestId('territory-card')).not.toHaveAttribute('aria-busy')

    rerender(<TerritoryBand {...HEAT} pending />)
    expect(headline()).toHaveClass('min-h-[2lh]')
    expect(screen.getByTestId('territory-card')).toHaveAttribute('aria-busy', 'true')
  })
})
