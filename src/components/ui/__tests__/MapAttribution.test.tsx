import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MapAttribution } from '../MapAttribution'

describe('MapAttribution (3.0)', () => {
  it('folds the credits behind an ⓘ and opens them on a tap', () => {
    render(<MapAttribution />)
    const button = screen.getByRole('button', { name: 'Map credits' })
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: '© OpenStreetMap contributors' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
    expect(screen.getByRole('link', { name: '© MapTiler' })).toHaveAttribute('href', 'https://www.maptiler.com/copyright/')
  })

  it('closes on Escape and on a tap outside', () => {
    render(<MapAttribution />)
    const button = screen.getByRole('button', { name: 'Map credits' })
    fireEvent.click(button)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(button)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('note')).toBeNull()
  })
})
