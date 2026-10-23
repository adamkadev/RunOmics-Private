import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { GlassTabBar } from '../GlassTabBar'
import { FullscreenChromeProvider, useSetFullscreenChromeHidden } from '../FullscreenChromeContext'

const push = vi.fn()
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push }) }))

describe('GlassTabBar', () => {
  it('keeps exactly five destinations and does not add a Coach tab', () => {
    render(<GlassTabBar />)

    expect(screen.getByRole('navigation').querySelectorAll('a')).toHaveLength(5)
    expect(screen.queryByRole('link', { name: /coach/i })).not.toBeInTheDocument()
  })

  it('floats a 62 pt glass capsule 24 pt in from the sides and the bottom', () => {
    render(<GlassTabBar />)
    const nav = screen.getByRole('navigation')
    expect(nav.style.paddingBottom).toBe('var(--tab-bar-float)')
    expect(nav.className).toContain('px-6')
    const capsule = screen.getByTestId('tab-bar-capsule')
    expect(capsule.className).toMatch(/\blg lg-tab\b/)
    expect(capsule.className).toContain('h-[var(--tab-bar-h)]')
    expect([...capsule.querySelectorAll(':scope > i')].map((i) => i.className)).toEqual(['lg-blur', 'lg-edge', 'lg-tint'])
    // A sibling, never the capsule's ancestor, so the capsule's blur has no
    // backdrop root.
    const edge = screen.getByTestId('bottom-glass')
    expect(edge.className).toContain('bottom-edge')
    expect(edge.querySelectorAll(':scope > i')).toHaveLength(2)
    expect(edge.contains(capsule)).toBe(false)
    expect(edge.parentElement).toBe(nav)
  })

  it('dissolves the page into the bar over a 120 pt soft edge, with no hairline', () => {
    const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')
    const block = (selector: string) => {
      const at = css.indexOf(`${selector} {`)
      return css.slice(at, css.indexOf('}', at))
    }
    expect(block('.bottom-edge')).toContain('position: absolute')
    expect(block('.bottom-edge')).toContain('height: 120px')
    expect(block('.bottom-edge > i:nth-child(1)')).toContain('linear-gradient(to top, #000 45%, transparent)')
    expect(block('.bottom-edge > i:nth-child(1)')).toContain('blur(6px)')
    expect(block('.bottom-edge > i:nth-child(2)')).toMatch(/72%, transparent\) 0%,[\s\S]*40%, transparent\) 45%,[\s\S]*transparent 100%/)
    expect(css.slice(css.indexOf('.bottom-edge {'), css.indexOf('.bottom-edge > i:nth-child(2)') + 400)).not.toMatch(/border/)
    // Reduced transparency, increased contrast and solid glass drop the blur,
    // never the tint.
    expect(css.match(/\.bottom-edge > i:nth-child\(1\)[^{]*\{ display: none; \}/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(css).toMatch(/html\[data-glass="solid"\] \.bottom-edge > i:nth-child\(1\)/)
    expect(css).not.toMatch(/\.bottom-edge > i:nth-child\(2\)[^{]*\{ display: none/)
  })

  it('writes the labels at the 10 pt tab size, never text-micro', () => {
    render(<GlassTabBar />)

    for (const link of screen.getAllByRole('link')) {
      const label = link.querySelector('span')!
      expect(label.className).toContain('text-tab')
      expect(label.className).not.toContain('text-micro')
    }
  })

  // Label ink, not muted grey: only it reads 4.5:1 over a busy map.
  it('puts only the active tab on the pill, in the accent, the rest in label ink', () => {
    render(<GlassTabBar />)
    const links = screen.getAllByRole('link')
    const active = links.filter((link) => link.getAttribute('aria-current') === 'page')
    expect(active).toHaveLength(1)
    expect(active[0]!.className).toContain('text-accent-text')
    expect(active[0]!.querySelector('span')!.className).toContain('font-semibold')
    for (const link of links) {
      if (link === active[0]) continue
      expect(link.className).toContain('text-foreground')
      expect(link.className).not.toContain('text-muted-foreground')
    }
    const pill = screen.getByTestId('tab-pill')
    expect(pill.style.background).toBe('var(--tab-pill)')
    expect(pill.style.transform).toBe('translateX(0%)')
  })

  // A plain tap is still the link's own.
  it('turns the pill into a clear lens while pressed', () => {
    render(<GlassTabBar />)
    const row = screen.getByTestId('tab-pill').parentElement!
    fireEvent.pointerDown(row, { clientX: 10, pointerId: 1 })
    const pill = screen.getByTestId('tab-pill')
    expect(pill.hasAttribute('data-lens')).toBe(true)
    expect(pill.className).toMatch(/\blg lg-clear\b/)
    expect(pill.style.top).toBe('-9px')
    fireEvent.pointerUp(row, { clientX: 10, pointerId: 1 })
    expect(screen.getByTestId('tab-pill').hasAttribute('data-lens')).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('shrinks to the active tab on a scroll down and comes back', () => {
    render(<GlassTabBar />)
    const capsule = screen.getByTestId('tab-bar-capsule')
    const shrunk = screen.getByTestId('tab-bar-collapsed')
    const scrollTo = (y: number) => act(() => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
      fireEvent.scroll(window)
    })

    scrollTo(60)
    expect(capsule.style.width).toBe('100%')
    scrollTo(300)
    expect(capsule.style.width).toBe('var(--tab-bar-h)')
    expect(capsule.hasAttribute('data-collapsed')).toBe(true)
    expect(capsule.contains(shrunk)).toBe(true)
    expect(shrunk.className).toContain('opacity-100')
    expect(shrunk.getAttribute('aria-label')).toBe(t.nav.showTabs(t.nav.items.dashboard))

    scrollTo(250)
    expect(capsule.style.width).toBe('100%')

    scrollTo(500)
    expect(capsule.style.width).toBe('var(--tab-bar-h)')
    fireEvent.click(shrunk)
    expect(capsule.style.width).toBe('100%')
    expect(shrunk.className).toContain('opacity-0')
    scrollTo(0)
  })

  it('slides the pill to the tab tapped, as it is tapped', () => {
    render(<GlassTabBar />)
    const plan = screen.getByRole('link', { name: /Plan/ })
    plan.addEventListener('click', (e) => e.preventDefault())
    fireEvent.click(plan)
    expect(screen.getByTestId('tab-pill').style.transform).toBe('translateX(200%)')
    expect(plan.className).toContain('text-accent-text')
    // Still Today's page until the route changes.
    expect(plan.getAttribute('aria-current')).toBeNull()
  })

  it('drops the soft edge with the bar in a fullscreen map', () => {
    function Fullscreen() {
      useSetFullscreenChromeHidden(true)
      return null
    }
    render(
      <FullscreenChromeProvider>
        <Fullscreen />
        <GlassTabBar />
      </FullscreenChromeProvider>,
    )
    expect(screen.queryByTestId('bottom-glass')).toBeNull()
  })

  it('marks Progress with the trophy, not the person', () => {
    render(<GlassTabBar />)
    const progress = screen.getByRole('link', { name: /Progress/ })
    expect(progress.querySelector('path')!.getAttribute('d')).toMatch(/^M8 4h8v5a4 4 0 0 1-8 0z/)
  })
})
