import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatReadout } from '../StatReadout'

describe('StatReadout', () => {
  it('gives every value a label, a swatch and a unit', () => {
    render(
      <StatReadout
        heading="At 2.4 km"
        items={[
          { key: 'hr', label: 'Heart rate', color: 'red', value: '113', unit: 'bpm' },
          { key: 'pace', label: 'Pace', color: 'blue', value: '4:25', unit: '/km' },
        ]}
      />,
    )

    expect(screen.getByText('Heart rate')).toBeInTheDocument()
    expect(screen.getByText('Pace')).toBeInTheDocument()
    expect(screen.getByText('113').parentElement ?? screen.getByText(/113/)).toHaveTextContent('113 bpm')
    expect(screen.getByText(/4:25/)).toHaveTextContent('4:25 /km')
  })
})
