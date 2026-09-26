import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RouteThumb } from '../RouteThumb'

describe('RouteThumb', () => {
  it('strokes the route in the run type zone colour', () => {
    render(<RouteThumb path="M0 0 L10 10" type="Base" />)
    const path = screen.getByTestId('route-thumb').querySelector('path')!
    expect(path.getAttribute('stroke')).toBe('var(--zone-2)')
  })

  it('shows the neutral tile for a treadmill run', () => {
    render(<RouteThumb path={null} type="Base" size={56} />)
    const tile = screen.getByTestId('route-thumb')
    expect(tile.dataset.neutral).toBe('true')
    expect(tile.style.width).toBe('56px')
  })
})
