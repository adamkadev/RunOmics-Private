import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { CompactTitleBar, titleColumns } from '../CompactTitleBar'

vi.mock('next/navigation', () => ({ usePathname: () => '/plan' }))

// A 47 pt status bar under which the 52 pt bar sits: its divider is at 99.
const STATUS_BAR = 47
const DIVIDER = STATUS_BAR + 58

let scrollY = 0

/** Lays an element at `top` in the page, `height` tall; it moves with the scroll. */
function place(el: Element, top: number, height: number) {
  ;(el as HTMLElement).getBoundingClientRect = () => ({ top: top - scrollY, bottom: top + height - scrollY }) as DOMRect
}

/** A tab's own page: the large title at `top`, its subtitle 44 pt lower. */
function tabPage(top = STATUS_BAR + 4) {
  document.body.innerHTML = '<main><div><h1>Plan</h1><p>Thu, Sep 24</p></div></main>'
  place(document.querySelector('h1')!, top, 40)
  place(document.querySelector('p')!, top + 44, 20)
}

/**
 * A page reached from another: its back link at the top, then the title and
 * its date line, the page's Share, and a section label further down.
 */
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

// As a UINavigationBar places its title (Liquid Glass v2, section 11).
describe('titleColumns', () => {
  it('centres the title on the screen when it fits between equal sides', () => {
    // A back circle (16 + 44) and a Share circle: equal sides, centred.
    expect(titleColumns(393, 60, 60, 120)).toBe('60px minmax(0,1fr) 60px')
    // A narrow left and a wider right that still leave room: equal sides.
    expect(titleColumns(393, 16, 120, 80)).toBe('120px minmax(0,1fr) 120px')
  })

  it("centres it in the room left when a side is too wide (Analytics' 4W | 12W | 1Y)", () => {
    expect(titleColumns(393, 16, 182, 80)).toBe('16px minmax(0,1fr) 182px')
    // Goals & season beside its back circle and ‹ 2026 ›.
    expect(titleColumns(393, 60, 150, 120)).toBe('60px minmax(0,1fr) 150px')
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

  // v4.3.2: the large title, once under the status bar, comes back as the
  // bar's centred 17 pt title rather than cut in half.
  it("shows the page's title once its large title is under the status bar", async () => {
    tabPage()
    await mount(60)
    expect(shown()).toBe(true)
    // The page name, centred, as Bevel's top shows it (owner, Oct 2026).
    expect(bar().textContent).toBe('Plan')
    expect(within(bar()).getByText('Plan').className).toContain('text-[17px]')
    // The design review's 52 pt bar (Oct 2026), under the status strip.
    expect(bar().style.height).toBe('58px')
    // No surface of its own: the soft scroll edge fades in under it
    // (data-bar-shown, Liquid Glass v2), and only its buttons take taps.
    expect(bar().className).not.toContain('glass')
    expect(bar().className).toContain('pointer-events-none')
    expect(document.documentElement.hasAttribute('data-bar-shown')).toBe(true)
  })

  // At rest the large title sits under the status bar, inside the bar's
  // height: the bar waits until the title itself goes under the status bar.
  it('stays hidden, and not drawn at all, while the large title is in view', async () => {
    tabPage()
    await mount(0)
    expect(shown()).toBe(false)
    // At rest the status strip stays opaque: no glass switch on <html>.
    expect(document.documentElement.hasAttribute('data-bar-shown')).toBe(false)
    // Not drawn rather than transparent: iOS 26 blurred the page under an
    // invisible fixed bar at the top edge.
    expect(bar().className).toContain('hidden')
    expect(bar().className).not.toContain('opacity-0')
  })

  // v4.6: the large title read as blurred after a tab swap, and a title left
  // half-faded on screen reads as a blurred one. At the top it is plainly
  // itself; it stays whole until the bar collapses in, then cross-fades with
  // the bar's title over 150 ms - never a filter (design review, Oct 2026).
  // The bar collapses in as the title reaches the edge sampler, 12 pt under
  // the status bar (Liquid Glass v2), before it can slide under it.
  it('keeps the large title sharp until the bar collapses in, then cross-fades it', async () => {
    tabPage(STATUS_BAR + 12 + 12)
    await mount(0)
    const title = document.querySelector('h1')!
    expect(title.getAttribute('style') ?? '').toBe('')

    // Two points down is still the top: nothing moves yet.
    await scrollTo(2)
    expect(title.getAttribute('style') ?? '').toBe('')
    expect(shown()).toBe(false)

    // On the way up, still whole.
    await scrollTo(6)
    expect(title.style.opacity).toBe('')
    expect(shown()).toBe(false)

    // At the sampler: the bar is in, the title fades out under it.
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

  // Design review, Oct 2026: on a page reached from another the bar comes in
  // after 24 pt, once the back link has gone, with the title still in view.
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
    // The page's 44 pt glass chevron, as at rest (Liquid Glass v2).
    expect(chevron.className).toContain('size-11')
    expect(chevron.className).toContain('glass-float')
    chevron.click()
    expect(back).toHaveBeenCalledTimes(1)
    // The page's own link has faded out as the chevron came in, and takes
    // no taps while it is invisible.
    expect((document.querySelector('[data-bar-back]') as HTMLElement).style.opacity).toBe('0')
    expect((document.querySelector('[data-bar-back]') as HTMLElement).style.pointerEvents).toBe('none')

    await scrollTo(0)
    expect(document.querySelector('[data-bar-back]')!.getAttribute('style') ?? '').toBe('')
  })

  // 3.0: the activity's title sits under a 330 pt map. Collapsing after 24 pt
  // faded it out while it was still mid-screen; the bar waits for it instead.
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

  // Today's avatar and Progress' gear stay at the top right once the page
  // scrolls, as Bevel keeps its own (owner, Oct 2026).
  it("keeps Today's sync and avatar, and Progress' gear, in the bar", async () => {
    tabPage()
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<a data-bar-action="avatar" aria-label="Progress"><span>A</span></a>')
    await mount(60)
    const avatar = within(bar()).getByRole('button', { name: 'Progress' })
    expect(avatar.textContent).toBe('A')
    expect(avatar.className).toContain('bg-accent')

    // Today's sync beside it: two glass circles, sync first, no capsule
    // around them (Liquid Glass v2, section 11).
    document.body.innerHTML = ''
    tabPage()
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<button data-bar-action="refresh" data-bar-busy aria-label="Synced 2h ago"></button><a data-bar-action="avatar" aria-label="Progress"><span>A</span></a>')
    const sync = vi.fn()
    document.querySelector('[data-bar-action="refresh"]')!.addEventListener('click', sync)
    await mount(60)
    expect(within(bar()).queryByTestId('compact-bar-capsule')).toBeNull()
    const [refresh, disc] = within(bar()).getAllByTestId('compact-bar-action')
    expect(refresh!.getAttribute('aria-label')).toBe('Synced 2h ago')
    expect(refresh!.className).toContain('glass-float')
    expect(refresh!.className).toContain('size-11')
    expect(disc!.className).toContain('size-11')
    expect(refresh!.parentElement!.className).toContain('gap-2')
    expect(refresh!.querySelector('svg')!.getAttribute('class')).toContain('animate-spin')
    expect(disc!.textContent).toBe('A')
    refresh!.click()
    expect(sync).toHaveBeenCalledTimes(1)

    document.body.innerHTML = ''
    tabPage()
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<a data-bar-action="settings" aria-label="Settings"></a>')
    await mount(60)
    const gear = within(bar()).getByRole('button', { name: 'Settings' })
    expect(gear.className).toContain('glass-float')
    expect(gear.querySelector('svg')).not.toBeNull()
  })

  // List | Map, 4W | 12W | 1Y, Week | Month (owner, Oct 2026): mirrored in
  // glass once the page's own control has gone under the bar, never beside it.
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

  // Goals' ‹ 2026 › (Liquid Glass v2, round 2): one glass capsule, its
  // arrows pressing the page's own, the year between them.
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
    expect(add.className).toContain('glass-float')
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
    // The page's own button hands over to it rather than show cut under it.
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

  // v4.3.3: a sticky tab strip moves under the bar while it shows.
  it('moves the sticky strips under the bar while it shows, and back after', async () => {
    tabPage()
    await mount(60)
    expect(document.documentElement.style.getPropertyValue('--sticky-top')).toBe('calc(var(--safe-top) + 58px)')
    await scrollTo(0)
    expect(document.documentElement.style.getPropertyValue('--sticky-top')).toBe('')
  })

  // v4.3.3: the subtitle fades out on the way up and is gone by the time its
  // top edge reaches the bar's divider, so no clipped glyphs show under it.
  it('fades the subtitle out before it reaches the divider', async () => {
    pushedPage()
    await mount(0)
    const subtitle = document.querySelector<HTMLElement>('header p')!
    // At rest it carries no inline opacity at all (v4.17): one written before
    // a client page hydrates was a hydration mismatch.
    expect(subtitle.style.opacity).toBe('')

    await scrollTo(14)
    const midway = Number(subtitle.style.opacity)
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(1)

    // Its top edge at the divider (127 - 28 = 99): fully faded, and so while
    // it straddles it.
    for (const y of [28, 40]) {
      await scrollTo(y)
      expect(subtitle.style.opacity, `scrolled ${y}`).toBe('0')
    }
  })

  // A tab's own subtitle sits under the bar's 52 pt already at rest: it is
  // gone by the time the bar collapses in, rather than shown cut by it.
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

  // "DATA" in Settings peeked out under the bar (design review, Oct 2026).
  it('fades a section label out before it reaches the divider', async () => {
    pushedPage()
    await mount(0)
    const label = document.querySelector<HTMLElement>('h2')!
    // Its top 8 pt under the divider: half gone.
    await scrollTo(447 - DIVIDER - 8)
    expect(Number(label.style.opacity)).toBeCloseTo(0.5, 1)
    // At the divider and across it: gone.
    await scrollTo(447 - DIVIDER + 5)
    expect(label.style.opacity).toBe('0')
    // Well below it, and with the bar hidden: as the page drew it.
    await scrollTo(100)
    expect(label.style.opacity).toBe('')
    await scrollTo(0)
    expect(label.getAttribute('style') ?? '').toBe('')
  })

  // The bar is a phone's: a wide screen keeps the page's own header as it is.
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
