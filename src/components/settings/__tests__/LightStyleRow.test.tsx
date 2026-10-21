import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { LightStyleRow } from '../LightStyleSegmented'

// Liquid Glass v3 (G14): Settings › Appearance › Light background.
describe('Light background', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-light-style')
  })

  it('defaults to the Aura, with no attribute on <html>', () => {
    render(<LightStyleRow />)
    expect(screen.getByRole('button', { name: t.settings.appearance.aura })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('light-style-hint').textContent).toBe(t.settings.appearance.auraHint)
    expect(document.documentElement.hasAttribute('data-light-style')).toBe(false)
  })

  it('switches to Plain at once, stored and on <html>, and back', () => {
    render(<LightStyleRow />)
    fireEvent.click(screen.getByRole('button', { name: t.settings.appearance.plain }))
    expect(localStorage.getItem('lightStyle')).toBe('plain')
    expect(document.documentElement.getAttribute('data-light-style')).toBe('plain')
    expect(screen.getByTestId('light-style-hint').textContent).toBe(t.settings.appearance.plainHint)

    fireEvent.click(screen.getByRole('button', { name: t.settings.appearance.aura }))
    expect(localStorage.getItem('lightStyle')).toBeNull()
    expect(document.documentElement.hasAttribute('data-light-style')).toBe(false)
  })
})
