import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CompactTitleBar } from '../CompactTitleBar'

vi.mock('next/navigation', () => ({ usePathname: () => '/plan' }))

// A 47 pt status bar under a 44 pt bar.
function page(top: number, scrollY = 120) {
  document.body.innerHTML = '<main><h1>Plan</h1></main>'
  const h1 = document.querySelector('h1')!
  h1.getBoundingClientRect = () => ({ top, bottom: top + 40 }) as DOMRect
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY })
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  })
}

describe('CompactTitleBar', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 91 })
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  // v4.3.2: the large title, once under the top bar, comes back as the bar's
  // centred 17 pt title rather than cut in half.
  it("shows the page's title once its large title is under the bar", async () => {
    page(10)
    render(<CompactTitleBar />, { container: document.body.appendChild(document.createElement('div')) })
    await flush()
    const bar = screen.getByTestId('compact-title-bar')
    expect(bar.hasAttribute('data-shown')).toBe(true)
    expect(bar.textContent).toBe('Plan')
    expect(bar.querySelector('span')!.className).toContain('text-[17px]')
  })

  // At rest the large title sits under the status bar, inside the bar's
  // height: the bar waits until the title itself goes under the status bar.
  it('stays hidden while the large title is in view', async () => {
    page(60, 0)
    render(<CompactTitleBar />, { container: document.body.appendChild(document.createElement('div')) })
    await flush()
    const bar = screen.getByTestId('compact-title-bar')
    expect(bar.hasAttribute('data-shown')).toBe(false)
    // Not drawn at all rather than transparent: iOS 26 blurred the page under
    // an invisible fixed bar at the top edge.
    expect(bar.className).toContain('hidden')
    expect(bar.className).not.toContain('opacity-0')
  })

  it('stays hidden with the title just below the status bar', async () => {
    page(60, 20)
    render(<CompactTitleBar />, { container: document.body.appendChild(document.createElement('div')) })
    await flush()
    expect(screen.getByTestId('compact-title-bar').hasAttribute('data-shown')).toBe(false)
  })
})
