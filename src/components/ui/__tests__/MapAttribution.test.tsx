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

  it('adds a map’s own credits after the base map’s: its link where it has one, a known name’s otherwise', () => {
    render(
      <MapAttribution
        extraCredits={[
          { text: 'Ville de Metz – Quartiers', href: 'https://example.org/quartiers' },
          { text: '© openrouteservice by HeiGIT' },
          { text: 'Plain credit' },
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Map credits' }))
    const note = screen.getByRole('note')
    expect(note.textContent).toBe('© MapTiler · © OpenStreetMap contributors · Ville de Metz – Quartiers · © openrouteservice by HeiGIT · Plain credit')
    expect(screen.getByRole('link', { name: 'Ville de Metz – Quartiers' })).toHaveAttribute('href', 'https://example.org/quartiers')
    expect(screen.getByRole('link', { name: '© openrouteservice by HeiGIT' })).toHaveAttribute('href', 'https://openrouteservice.org/terms-of-service/')
    expect(screen.queryByRole('link', { name: 'Plain credit' })).toBeNull()
  })

  it('keeps each separator at the end of its credit, so no line of the note starts with one', () => {
    render(<MapAttribution extraCredits={[{ text: 'IGN – ADMIN EXPRESS COG' }, { text: '© openrouteservice by HeiGIT' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Map credits' }))
    const groups = [...screen.getByRole('note').children].map((group) => [group.textContent, group.className])
    expect(groups).toEqual([
      ['© MapTiler ·', 'whitespace-nowrap'],
      ['© OpenStreetMap contributors ·', 'whitespace-nowrap'],
      ['IGN – ADMIN EXPRESS COG ·', 'whitespace-nowrap'],
      ['© openrouteservice by HeiGIT', 'whitespace-nowrap'],
    ])
  })
})
