import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../AppShell'

const route = vi.hoisted(() => ({ pathname: '/activities' }))

vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }))
vi.mock('../Sidebar', () => ({ Sidebar: () => null }))
vi.mock('../ThemeSync', () => ({ ThemeSync: () => null }))
vi.mock('../PageTransition', () => ({ PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('../NavigationHistory', () => ({ NavigationHistoryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  fireEvent.scroll(window)
}

function stored(): Record<string, number> {
  return JSON.parse(sessionStorage.getItem('scrollPositions') ?? '{}')
}

describe('AppShell scroll memory', () => {
  let writes: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    sessionStorage.clear()
    route.pathname = '/activities'
    window.scrollTo = () => {}
    writes = vi.spyOn(Storage.prototype, 'setItem')
  })
  afterEach(() => writes.mockRestore())

  it('does not write storage while the reader scrolls', () => {
    render(<AppShell>page</AppShell>)
    for (const y of [120, 480, 900]) scrollTo(y)

    expect(writes).not.toHaveBeenCalled()
  })

  it('keeps the offset when the tab goes away', () => {
    render(<AppShell>page</AppShell>)
    scrollTo(640)
    fireEvent(window, new Event('pagehide'))

    expect(stored()).toEqual({ '/activities': 640 })
  })

  it('keeps the offset the page had when the route changes', () => {
    const { rerender } = render(<AppShell>page</AppShell>)
    scrollTo(900)

    // By the old route's cleanup, scrollY already reads the shorter next
    // page's clamped offset.
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true })
    route.pathname = '/activities/1'
    rerender(<AppShell>detail</AppShell>)

    expect(stored()['/activities']).toBe(900)
  })
})

describe('AppShell surface', () => {
  it('draws no aurora and no gradient over the page top', () => {
    const { container, queryByTestId } = render(<AppShell>page</AppShell>)
    expect(container.querySelector('.aurora')).toBeNull()
    expect(queryByTestId('status-bar-blend')).toBeNull()
  })

  // Without a fixed opaque bar at the top edge, iOS 26 blurs the installed
  // app's top over the page.
  it('keeps the edge sampler and the soft scroll edge at the top for iOS', () => {
    const { getByTestId } = render(<AppShell>page</AppShell>)
    expect(getByTestId('edge-sampler').className).toContain('edge-sampler')
    // Three blurs and a tint.
    expect(getByTestId('scroll-edge').querySelectorAll(':scope > i')).toHaveLength(4)
  })
})

// The sign-in page stands alone: no navigation to pages a signed-out visitor
// cannot open.
describe('AppShell on the sign-in page', () => {
  afterEach(() => {
    route.pathname = '/activities'
  })

  it('draws the page without the app around it', () => {
    route.pathname = '/sign-in'
    const { getByText, queryByTestId } = render(<AppShell>sign in</AppShell>)
    expect(getByText('sign in')).toBeInTheDocument()
    expect(queryByTestId('edge-sampler')).toBeNull()
    expect(queryByTestId('scroll-edge')).toBeNull()
  })

  it('glows', () => {
    route.pathname = '/sign-in'
    const { getByTestId } = render(<AppShell>sign in</AppShell>)
    expect(getByTestId('aura')).toBeInTheDocument()
  })
})
