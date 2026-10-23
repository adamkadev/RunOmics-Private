import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { Aura } from '@/components/layout/Aura'
import { GlowRow } from '../GlowRow'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('Background glow', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-glow')
  })

  it('is on by default, with no attribute on <html>', () => {
    render(<><GlowRow /><Aura /></>)
    expect(screen.getByRole('switch', { name: t.settings.appearance.glowLabel })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('glow-hint').textContent).toBe(t.settings.appearance.glowHint)
    expect(document.documentElement.hasAttribute('data-glow')).toBe(false)
    expect(document.querySelector('.aura')).not.toBeNull()
  })

  it('turns off at once, stored and on <html>, the aura gone - and back', () => {
    render(<><GlowRow /><Aura /></>)
    fireEvent.click(screen.getByRole('switch', { name: t.settings.appearance.glowLabel }))
    expect(localStorage.getItem('ro-glow')).toBe('off')
    expect(document.documentElement.getAttribute('data-glow')).toBe('off')
    expect(document.querySelector('.aura')).toBeNull()

    fireEvent.click(screen.getByRole('switch', { name: t.settings.appearance.glowLabel }))
    expect(localStorage.getItem('ro-glow')).toBe('on')
    expect(document.documentElement.hasAttribute('data-glow')).toBe(false)
    expect(document.querySelector('.aura')).not.toBeNull()
  })
})
