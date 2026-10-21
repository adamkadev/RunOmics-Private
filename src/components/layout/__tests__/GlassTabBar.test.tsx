import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { GlassTabBar } from '../GlassTabBar'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('GlassTabBar', () => {
  it('keeps exactly five destinations and does not add a Coach tab', () => {
    render(<GlassTabBar />)

    expect(screen.getByRole('navigation').querySelectorAll('a')).toHaveLength(5)
    expect(screen.queryByRole('link', { name: /coach/i })).not.toBeInTheDocument()
  })

  // Floating, as Bevel draws it (owner, Oct 2026): about 19 pt off the
  // bottom edge on a notched iPhone, clear of the home indicator's swipe zone.
  it('floats a glass capsule off the bottom edge', () => {
    render(<GlassTabBar />)
    expect(screen.getByRole('navigation').style.paddingBottom).toBe('var(--tab-bar-float)')
    const capsule = screen.getByTestId('tab-bar-capsule')
    expect(capsule.className).toContain('glass-float')
    expect(capsule.className).toContain('rounded-full')
  })

  it('writes the labels at the 11 px caption size, never text-micro', () => {
    render(<GlassTabBar />)

    for (const link of screen.getAllByRole('link')) {
      const label = link.querySelector('span')!
      expect(label.className).toContain('text-caption')
      expect(label.className).not.toContain('text-micro')
    }
  })

  // The active tab is its icon and label in the accent on a soft pill (owner,
  // Oct 2026, after Bevel); 3.0: one 500 weight for every label.
  it('puts only the active tab on the pill, in the accent', () => {
    render(<GlassTabBar />)
    const links = screen.getAllByRole('link')
    const active = links.filter((link) => link.getAttribute('aria-current') === 'page')
    expect(active).toHaveLength(1)
    expect(active[0]!.className).toContain('text-accent')
    expect(active[0]!.querySelector('span')!.className).toContain('font-medium')
    for (const link of links) if (link !== active[0]) expect(link.className).toContain('text-muted-foreground')
    // One pill behind the row, on the first tab (Today).
    const pill = screen.getByTestId('tab-pill')
    expect(pill.className).toContain('bg-[var(--tab-pill)]')
    expect(pill.style.transform).toBe('translateX(calc(0 * (100% + 4px)))')
  })

  // iOS 26's tab bar, as Bevel draws it: a scroll down shrinks it to the
  // active tab's icon; a scroll up, or a tap on that button, brings it back.
  it('shrinks to the active tab on a scroll down and comes back', () => {
    render(<GlassTabBar />)
    const capsule = screen.getByTestId('tab-bar-capsule')
    const shrunk = screen.getByTestId('tab-bar-collapsed')
    const scrollTo = (y: number) => act(() => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
      fireEvent.scroll(window)
    })

    scrollTo(60)
    expect(capsule.className).toContain('opacity-100')
    scrollTo(300)
    expect(capsule.className).toContain('opacity-0')
    expect(shrunk.className).toContain('opacity-100')
    expect(shrunk.getAttribute('aria-label')).toBe(t.nav.showTabs(t.nav.items.dashboard))

    scrollTo(250)
    expect(capsule.className).toContain('opacity-100')

    scrollTo(500)
    expect(capsule.className).toContain('opacity-0')
    fireEvent.click(shrunk)
    expect(capsule.className).toContain('opacity-100')
    scrollTo(0)
  })

  // The pill glides to the tab tapped at once, before its page has loaded,
  // as Bevel's does (owner, Oct 2026).
  it('slides the pill to the tab tapped, as it is tapped', () => {
    render(<GlassTabBar />)
    const plan = screen.getByRole('link', { name: /Plan/ })
    plan.addEventListener('click', (e) => e.preventDefault())
    fireEvent.click(plan)
    expect(screen.getByTestId('tab-pill').style.transform).toBe('translateX(calc(2 * (100% + 4px)))')
    expect(plan.className).toContain('text-accent')
    // The page shown is still Today until the route changes.
    expect(plan.getAttribute('aria-current')).toBeNull()
  })

  it('marks Progress with the trophy, not the person', () => {
    render(<GlassTabBar />)
    const progress = screen.getByRole('link', { name: /Progress/ })
    expect(progress.querySelector('path')!.getAttribute('d')).toMatch(/^M8 4h8v5a4 4 0 0 1-8 0z/)
  })
})
