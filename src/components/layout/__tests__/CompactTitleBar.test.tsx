import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CompactTitleBar } from '../CompactTitleBar'

vi.mock('next/navigation', () => ({ usePathname: () => '/plan' }))

// A 47 pt status bar under which the 44 pt bar sits: its divider is at 91.
const STATUS_BAR = 47

let scrollY = 0
const rects = new Map<string, { top: number; bottom: number }>()

// The large title at `top`, its subtitle 44 pt lower; both move with the scroll.
function page(top: number, scroll: number) {
  document.body.innerHTML = '<main><div><h1>Plan</h1><p>Thu, Sep 24</p></div></main>'
  scrollY = 0
  rects.set('H1', { top, bottom: top + 40 })
  rects.set('P', { top: top + 44, bottom: top + 64 })
  for (const tag of ['H1', 'P']) {
    const el = document.querySelector<HTMLElement>(tag.toLowerCase())!
    el.getBoundingClientRect = () => {
      const r = rects.get(tag)!
      return { top: r.top - scrollY, bottom: r.bottom - scrollY } as DOMRect
    }
  }
  return () => {
    scrollY = scroll
  }
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  })
}

async function mount(scrollTo: () => void) {
  render(<CompactTitleBar />, { container: document.body.appendChild(document.createElement('div')) })
  await flush()
  scrollTo()
  window.dispatchEvent(new Event('scroll'))
  await flush()
}

describe('CompactTitleBar', () => {
  beforeEach(() => {
    // The probe measures the status bar; the bar has no height while hidden.
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => STATUS_BAR })
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  })
  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.style.removeProperty('--sticky-top')
  })

  // v4.3.2: the large title, once under the status bar, comes back as the
  // bar's centred 17 pt title rather than cut in half.
  it("shows the page's title once its large title is under the status bar", async () => {
    await mount(page(STATUS_BAR + 4, 60))
    const bar = screen.getByTestId('compact-title-bar')
    expect(bar.hasAttribute('data-shown')).toBe(true)
    expect(bar.textContent).toBe('Plan')
    expect(bar.querySelector('span')!.className).toContain('text-[17px]')
    // Text crossing the divider fades out under it instead of showing cut.
    expect(bar.className).toContain('after:bg-gradient-to-b')
  })

  // At rest the large title sits under the status bar, inside the bar's
  // height: the bar waits until the title itself goes under the status bar.
  it('stays hidden, and not drawn at all, while the large title is in view', async () => {
    await mount(page(STATUS_BAR + 4, 0))
    const bar = screen.getByTestId('compact-title-bar')
    expect(bar.hasAttribute('data-shown')).toBe(false)
    // Not drawn rather than transparent: iOS 26 blurred the page under an
    // invisible fixed bar at the top edge.
    expect(bar.className).toContain('hidden')
    expect(bar.className).not.toContain('opacity-0')
  })

  it('stays hidden with the title just below the status bar', async () => {
    await mount(page(STATUS_BAR + 24, 20))
    expect(screen.getByTestId('compact-title-bar').hasAttribute('data-shown')).toBe(false)
  })

  // v4.3.3: a sticky tab strip moves under the bar while it shows.
  it('moves the sticky strips under the bar while it shows, and back after', async () => {
    await mount(page(STATUS_BAR + 4, 60))
    expect(document.documentElement.style.getPropertyValue('--sticky-top')).toBe('calc(var(--safe-top) + 44px)')
    scrollY = 0
    window.dispatchEvent(new Event('scroll'))
    await flush()
    expect(document.documentElement.style.getPropertyValue('--sticky-top')).toBe('')
  })

  // v4.3.3: the subtitle fades out on the way up and is gone by the time its
  // top edge reaches the bar's divider, so no clipped glyphs show under it.
  it('fades the subtitle out before it reaches the divider', async () => {
    // Title at 51, subtitle's top at 95: 4 pt above the divider at 91.
    const at = page(STATUS_BAR + 4, 0)
    await mount(at)
    const subtitle = document.querySelector('p')!
    expect(subtitle.style.opacity).toBe('1')

    scrollY = 2
    window.dispatchEvent(new Event('scroll'))
    await flush()
    const midway = Number(subtitle.style.opacity)
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(1)

    // Its top edge at the divider: fully faded, and so while it straddles it.
    for (const y of [4, 20]) {
      scrollY = y
      window.dispatchEvent(new Event('scroll'))
      await flush()
      expect(subtitle.style.opacity, `scrolled ${y}`).toBe('0')
    }
  })
})
