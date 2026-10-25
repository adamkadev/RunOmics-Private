import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { BAR_HEIGHT, CompactTitleBar, titleColumns } from '../CompactTitleBar'

vi.mock('next/navigation', () => ({ usePathname: () => '/plan' }))

// An iPhone's status bar, in pt.
const STATUS_BAR = 47
const DIVIDER = STATUS_BAR + BAR_HEIGHT

let scrollY = 0

function place(el: Element, top: number, height: number) {
  ;(el as HTMLElement).getBoundingClientRect = () => ({ top: top - scrollY, bottom: top + height - scrollY }) as DOMRect
}

function tabPage(top = STATUS_BAR + 4) {
  document.body.innerHTML = '<main><div><h1>Plan</h1><p>Thu, Sep 24</p></div></main>'
  place(document.querySelector('h1')!, top, 40)
  place(document.querySelector('p')!, top + 44, 20)
}

function pushedPage() {
  document.body.innerHTML = `<main>
    <button data-bar-back>Progress</button>
    <header><h1>Recovery run</h1><p>Wed, Oct 7</p></header>
    <button data-bar-action="share">Share</button>
    <h2 data-bar-fade>Data</h2>
  </main>`
  place(document.querySelector('[data-bar-back]')!, STATUS_BAR + 4, 22)
  place(document.querySelector('h1')!, STATUS_BAR + 41, 35)
  place(document.querySelector('header p')!, STATUS_BAR + 80, 20)
  place(document.querySelector('[data-bar-action]')!, STATUS_BAR + 66, 34)
  place(document.querySelector('h2')!, STATUS_BAR + 400, 17)
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  })
}

async function scrollTo(y: number) {
  scrollY = y
  window.dispatchEvent(new Event('scroll'))
  await flush()
}

async function mount(y = 0) {
  scrollY = 0
  render(<CompactTitleBar />, { container: document.body.appendChild(document.createElement('div')) })
  await flush()
  await scrollTo(y)
}

const bar = () => screen.getByTestId('compact-title-bar')
const shown = () => bar().hasAttribute('data-shown')

describe('titleColumns', () => {
  it('centres the title on the screen when it fits between equal sides', () => {
    // A back circle (16 + 44) and a Share circle.
    expect(titleColumns(393, 60, 60, 120)).toEqual({ columns: '60px minmax(0,1fr) 60px', lead: null })
    // A narrow left and a wider right that still leave room.
    expect(titleColumns(393, 16, 120, 80)).toEqual({ columns: '120px minmax(0,1fr) 120px', lead: null })
  })

  it("lead-aligns it when it can't be centred on screen (Analytics' 4W | 12W | 1Y)", () => {
    // No back circle: the page's 16 pt margin.
    expect(titleColumns(402, 16, 182, 80)).toEqual({ columns: '16px minmax(0,1fr) 182px', lead: 0 })
    // 16 pt after a back circle, beside Goals' ‹ 2026 ›.
    expect(titleColumns(393, 60, 150, 120)).toEqual({ columns: '60px minmax(0,1fr) 150px', lead: 16 })
  })
})

describe('CompactTitleBar', () => {
  beforeEach(() => {
    // The probe measures the status bar; the bar has no height while hidden.
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => STATUS_BAR })
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  })
  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.style.removeProperty('--sticky-top')
    vi.restoreAllMocks()
  })

  it("shows the page's title once its large title is under the status bar", async () => {
    tabPage()
    await mount(60)
    expect(shown()).toBe(true)
    expect(bar().textContent).toBe('Plan')
    expect(within(bar()).getByText('Plan').className).toContain('text-headline')
    expect(bar().style.height).toBe('68px')
    expect(bar().className).not.toContain('glass')
    expect(bar().className).toContain('pointer-events-none')
    expect(document.documentElement.hasAttribute('data-bar-shown')).toBe(true)
  })

  it('writes a stuck sticky strip\'s height for the scroll edge, and clears it', async () => {
    tabPage()
    const strip = document.createElement('div')
    strip.setAttribute('data-sticky-strip', '')
    document.querySelector('main')!.appendChild(strip)
    strip.getBoundingClientRect = () => ({ top: DIVIDER, bottom: DIVIDER + STATUS_BAR }) as DOMRect
    const edge = document.createElement('div')
    edge.className = 'scroll-edge'
    document.body.appendChild(edge)
    await mount(60)
    expect(edge.style.getPropertyValue('--sticky-h')).toBe(`${STATUS_BAR}px`)
    expect(document.documentElement.style.getPropertyValue('--sticky-h')).toBe('')

    strip.getBoundingClientRect = () => ({ top: DIVIDER + 200, bottom: DIVIDER + 200 + STATUS_BAR }) as DOMRect
    await scrollTo(61)
    expect(edge.style.getPropertyValue('--sticky-h')).toBe('')
  })

  it("shows a page's short bar title where it has one (Goals & season)", async () => {
    tabPage()
    const heading = document.querySelector('h1')!
    heading.textContent = 'Goals & season'
    heading.dataset.barTitle = 'Goals'
    await mount(60)
    expect(bar().textContent).toBe('Goals')
  })

  it('stays hidden, and not drawn at all, while the large title is in view', async () => {
    tabPage()
    await mount(0)
    expect(shown()).toBe(false)
    expect(document.documentElement.hasAttribute('data-bar-shown')).toBe(false)
    // Not drawn rather than transparent: iOS 26 blurs the page under an
    // invisible fixed bar at the top edge.
    expect(bar().className).toContain('hidden')
    expect(bar().className).not.toContain('opacity-0')
  })

  // The bar collapses in as the title reaches the edge sampler, 12 pt under
  // the status bar.
  it('keeps the large title sharp until the bar collapses in, then cross-fades it', async () => {
    tabPage(STATUS_BAR + 12 + 12)
    await mount(0)
    const title = document.querySelector('h1')!
    expect(title.getAttribute('style') ?? '').toBe('')

    await scrollTo(2)
    expect(title.getAttribute('style') ?? '').toBe('')
    expect(shown()).toBe(false)

    await scrollTo(6)
    expect(title.style.opacity).toBe('')
    expect(shown()).toBe(false)

    await scrollTo(13)
    expect(shown()).toBe(true)
    expect(title.style.opacity).toBe('0')
    expect(title.style.transition).toBe('opacity 150ms ease-out')
    expect(title.style.filter).toBe('')
    expect(title.style.transform).toBe('')

    await scrollTo(0)
    expect(title.getAttribute('style') ?? '').toBe('')
  })

  it('stays hidden with the title just below the edge sampler', async () => {
    tabPage(STATUS_BAR + 12 + 30)
    await mount(20)
    expect(shown()).toBe(false)
  })

  it('collapses in after 24 pt with a back chevron that does what the back link does', async () => {
    pushedPage()
    const back = vi.fn()
    document.querySelector('[data-bar-back]')!.addEventListener('click', back)
    await mount(23)
    expect(shown()).toBe(false)
    expect(Number((document.querySelector('[data-bar-back]') as HTMLElement).style.opacity)).toBeGreaterThan(0)

    await scrollTo(24)
    expect(shown()).toBe(true)
    const chevron = within(bar()).getByRole('button', { name: t.nav.backTo('Progress') })
    expect(chevron.className).toContain('size-11')
    expect(chevron.className).toMatch(/(^|\s)lg(\s|$)/)
    chevron.click()
    expect(back).toHaveBeenCalledTimes(1)
    expect((document.querySelector('[data-bar-back]') as HTMLElement).style.opacity).toBe('0')
    expect((document.querySelector('[data-bar-back]') as HTMLElement).style.pointerEvents).toBe('none')

    await scrollTo(0)
    expect(document.querySelector('[data-bar-back]')!.getAttribute('style') ?? '').toBe('')
  })

  it('waits for a title under a hero to reach the bar', async () => {
    pushedPage()
    const title = document.querySelector('h1')!
    title.setAttribute('data-title-late', '')
    place(title, 400, 36)
    await mount(100)
    expect(shown()).toBe(false)
    expect(title.style.opacity).toBe('')

    await scrollTo(400 - DIVIDER)
    expect(shown()).toBe(true)
    expect(title.style.opacity).toBe('0')
  })

  it("keeps Today's sync and avatar, and Progress' gear, in the bar", async () => {
    tabPage()
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<a data-bar-action="avatar" aria-label="Progress"><span>A</span></a>')
    await mount(60)
    const avatar = within(bar()).getByRole('button', { name: 'Progress' })
    expect(avatar.textContent).toBe('A')
    expect(avatar.className).toContain('bg-accent')

    document.body.innerHTML = ''
    tabPage()
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<button data-bar-action="refresh" data-bar-busy aria-label="Synced 2h ago"></button><a data-bar-action="avatar" aria-label="Progress"><span>A</span></a>')
    const sync = vi.fn()
    document.querySelector('[data-bar-action="refresh"]')!.addEventListener('click', sync)
    await mount(60)
    const capsule = within(bar()).getByTestId('compact-bar-capsule')
    expect(capsule.className).toMatch(/(^|\s)lg(\s|$)/)
    expect(capsule.className).toContain('h-11')
    const [refresh, disc] = within(capsule).getAllByTestId('compact-bar-action')
    expect(refresh!.getAttribute('aria-label')).toBe('Synced 2h ago')
    expect(refresh!.className).not.toMatch(/(^|\s)lg(\s|$)/)
    expect(refresh!.className).toContain('size-11')
    expect(disc!.className).toContain('size-8')
    expect(disc!.className).toContain('bg-accent')
    expect(refresh!.querySelector('svg')!.getAttribute('class')).toContain('animate-spin')
    expect(disc!.textContent).toBe('A')
    refresh!.click()
    expect(sync).toHaveBeenCalledTimes(1)

    document.body.innerHTML = ''
    tabPage()
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<a data-bar-action="settings" aria-label="Settings"></a>')
    await mount(60)
    const gear = within(bar()).getByRole('button', { name: 'Settings' })
    expect(gear.className).toMatch(/(^|\s)lg(\s|$)/)
    expect(gear.querySelector('svg')).not.toBeNull()
  })

  it("carries the page's segmented control once it is under the bar", async () => {
    tabPage()
    document.querySelector('main')!.insertAdjacentHTML(
      'beforeend',
      '<div role="radiogroup" aria-label="Period" data-bar-segments><button aria-checked="true" aria-label="4 weeks">4W</button><button aria-checked="false" aria-label="12 weeks">12W</button></div>',
    )
    const group = document.querySelector('[data-bar-segments]')!
    place(group, STATUS_BAR + 200, 34)
    const twelve = vi.fn()
    group.querySelectorAll('button')[1]!.addEventListener('click', twelve)

    await mount(60)
    expect(shown()).toBe(true)
    expect(within(bar()).queryByTestId('compact-bar-segments')).toBeNull()

    await scrollTo(200)
    const mirror = within(bar()).getByTestId('compact-bar-segments')
    expect(mirror.getAttribute('aria-label')).toBe('Period')
    const [four, twelveMirror] = within(mirror).getAllByRole('button')
    expect(four!.textContent).toBe('4W')
    expect(four!.getAttribute('aria-pressed')).toBe('true')
    expect(twelveMirror!.getAttribute('aria-label')).toBe('12 weeks')
    twelveMirror!.click()
    expect(twelve).toHaveBeenCalledTimes(1)
  })

  it('hands a header control to the bar as it collapses in', async () => {
    document.body.innerHTML = `<main><header>
      <div><h1>Activities</h1><div role="tablist" aria-label="View" data-bar-segments><button role="tab" aria-selected="true">List</button><button role="tab" aria-selected="false">Map</button></div></div>
      <p data-title-sub>272 runs</p>
    </header></main>`
    place(document.querySelector('h1')!, STATUS_BAR + 4, 40)
    place(document.querySelector('[data-bar-segments]')!, STATUS_BAR + 4, 44)
    place(document.querySelector('p')!, STATUS_BAR + 48, 20)
    const group = document.querySelector<HTMLElement>('[data-bar-segments]')!
    await mount(0)
    expect(group.getAttribute('style')).toBeNull()

    await scrollTo(60)
    expect(shown()).toBe(true)
    expect(within(within(bar()).getByTestId('compact-bar-segments')).getAllByRole('button').map((b) => b.textContent)).toEqual(['List', 'Map'])
    expect(group.style.opacity).toBe('0')
    expect(group.style.pointerEvents).toBe('none')
    expect(document.querySelector<HTMLElement>('p')!.style.opacity).toBe('0')

    await scrollTo(0)
    expect(group.style.cssText).toBe('')
  })

  it("carries Goals' year stepper, and Shoes' add, in the bar", async () => {
    tabPage()
    document.querySelector('main')!.insertAdjacentHTML(
      'beforeend',
      '<div role="group" aria-label="Season year" data-bar-segments="stepper"><button aria-label="Previous year"></button><span data-bar-value>2026</span><button aria-label="Next year" disabled></button></div>',
    )
    const group = document.querySelector('[data-bar-segments]')!
    place(group, STATUS_BAR + 4, 34)
    const older = vi.fn()
    group.querySelectorAll('button')[0]!.addEventListener('click', older)
    await mount(60)
    const mirror = within(bar()).getByTestId('compact-bar-segments')
    expect(mirror.getAttribute('aria-label')).toBe('Season year')
    expect(mirror.textContent).toBe('2026')
    const [prev, next] = within(mirror).getAllByRole('button')
    expect(prev!.getAttribute('aria-label')).toBe('Previous year')
    expect(next).toBeDisabled()
    prev!.click()
    expect(older).toHaveBeenCalledTimes(1)

    document.body.innerHTML = ''
    tabPage()
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<a data-bar-action="add" aria-label="Add a pair"></a>')
    await mount(60)
    const add = within(bar()).getByRole('button', { name: 'Add a pair' })
    expect(add.className).toMatch(/(^|\s)lg(\s|$)/)
    expect(add.querySelector('svg')).not.toBeNull()
  })

  it("puts the page's one action at the bar's trailing end", async () => {
    pushedPage()
    const share = vi.fn()
    document.querySelector('[data-bar-action]')!.addEventListener('click', share)
    await mount(200)

    const action = within(bar()).getByRole('button', { name: 'Share' })
    expect(action.className).toContain('size-11')
    action.click()
    expect(share).toHaveBeenCalledTimes(1)
    const own = document.querySelector<HTMLElement>('[data-bar-action]')!
    expect(own.style.opacity).toBe('0')
    expect(own.style.pointerEvents).toBe('none')

    await scrollTo(10)
    expect(own.getAttribute('style') ?? '').toBe('')
  })

  it('has no chevron or action on a tab of its own', async () => {
    tabPage()
    await mount(60)
    expect(within(bar()).queryAllByRole('button')).toEqual([])
  })

  it('moves the sticky strips under the bar while it shows, and back after', async () => {
    tabPage()
    await mount(60)
    expect(document.documentElement.style.getPropertyValue('--sticky-top')).toBe('calc(var(--safe-top) + 68px)')
    await scrollTo(0)
    expect(document.documentElement.style.getPropertyValue('--sticky-top')).toBe('')
  })

  it('fades the subtitle out before it reaches the divider', async () => {
    pushedPage()
    await mount(0)
    const subtitle = document.querySelector<HTMLElement>('header p')!
    // No inline opacity at rest: one written before a client page hydrates
    // is a hydration mismatch.
    expect(subtitle.style.opacity).toBe('')

    await scrollTo(14)
    const midway = Number(subtitle.style.opacity)
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(1)

    // At 28 its top edge is at the divider (127 - 28 = 99).
    for (const y of [28, 40]) {
      await scrollTo(y)
      expect(subtitle.style.opacity, `scrolled ${y}`).toBe('0')
    }
  })

  it("fades a tab page's subtitle out by the time the bar collapses in", async () => {
    tabPage()
    await mount(2)
    const subtitle = document.querySelector('p')!
    expect(Number(subtitle.style.opacity)).toBeGreaterThan(0)
    expect(Number(subtitle.style.opacity)).toBeLessThan(1)
    await scrollTo(4)
    expect(shown()).toBe(true)
    expect(subtitle.style.opacity).toBe('0')
  })

  it('fades a section label out before it reaches the divider', async () => {
    pushedPage()
    await mount(0)
    const label = document.querySelector<HTMLElement>('h2')!
    // Its top 8 pt under the divider.
    await scrollTo(447 - DIVIDER - 8)
    expect(Number(label.style.opacity)).toBeCloseTo(0.5, 1)
    await scrollTo(447 - DIVIDER + 5)
    expect(label.style.opacity).toBe('0')
    await scrollTo(100)
    expect(label.style.opacity).toBe('')
    await scrollTo(0)
    expect(label.getAttribute('style') ?? '').toBe('')
  })

  it('looks the page up when it changes, not on every scroll frame', async () => {
    pushedPage()
    await mount(0)
    const lookups = vi.spyOn(document, 'querySelectorAll')
    for (const y of [10, 20, 30, 40]) await scrollTo(y)
    expect(lookups).not.toHaveBeenCalled()

    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<h2 data-bar-fade>Splits</h2>')
    await scrollTo(41)
    expect(lookups).toHaveBeenCalled()
  })

  it('leaves the page alone on a wide screen', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: query === '(min-width: 64rem)' }) as MediaQueryList)
    pushedPage()
    await mount(200)
    expect(shown()).toBe(false)
    expect(document.querySelector('h1')!.getAttribute('style') ?? '').toBe('')
    expect(document.querySelector('[data-bar-back]')!.getAttribute('style') ?? '').toBe('')
    expect(document.documentElement.style.getPropertyValue('--sticky-top')).toBe('')
  })
})
