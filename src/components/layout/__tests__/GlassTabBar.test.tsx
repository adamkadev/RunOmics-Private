import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GlassTabBar } from '../GlassTabBar'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('GlassTabBar', () => {
  it('keeps exactly five destinations and does not add a Coach tab', () => {
    render(<GlassTabBar />)

    expect(screen.getByRole('navigation').querySelectorAll('a')).toHaveLength(5)
    expect(screen.queryByRole('link', { name: /coach/i })).not.toBeInTheDocument()
  })

  // It used 60 % of the home-indicator inset, so the labels sat in the swipe zone.
  it('pads by the whole bottom safe area', () => {
    render(<GlassTabBar />)
    const bar = screen.getByRole('navigation').firstElementChild as HTMLElement

    expect(bar.style.paddingBottom).toBe('var(--safe-bottom)')
  })

  it('writes the labels at the 11 px caption size, never text-micro', () => {
    render(<GlassTabBar />)

    for (const link of screen.getAllByRole('link')) {
      const label = link.querySelector('span')!
      expect(label.className).toContain('text-caption')
      expect(label.className).not.toContain('text-micro')
    }
  })
})

