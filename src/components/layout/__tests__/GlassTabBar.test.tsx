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

  // 60 % of the inset put the labels in the swipe zone; the whole inset
  // floated the bar. The token is the inset less the space under the indicator.
  it('pads by the tab-bar share of the bottom safe area', () => {
    render(<GlassTabBar />)
    const bar = screen.getByRole('navigation').firstElementChild as HTMLElement

    expect(bar.style.paddingBottom).toBe('var(--tab-bar-bottom)')
  })

  it('writes the labels at the 11 px caption size, never text-micro', () => {
    render(<GlassTabBar />)

    for (const link of screen.getAllByRole('link')) {
      const label = link.querySelector('span > span')!
      expect(label.className).toContain('text-caption')
      expect(label.className).not.toContain('text-micro')
    }
  })

  // v4.3: the active item sits in a soft accent pill.
  it('puts the active tab in the soft accent pill', () => {
    render(<GlassTabBar />)
    const pills = screen.queryAllByTestId('tab-active-pill')
    expect(pills.length).toBeLessThanOrEqual(1)
    for (const pill of pills) expect(pill.getAttribute('style')).toContain('--acc-soft')
  })
})
