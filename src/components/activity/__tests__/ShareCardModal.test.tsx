import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShareActivity } from '@/lib/shareCardStats'
import { t } from '@/i18n'
import { ShareCardModal } from '../ShareCardModal'

const theme = vi.hoisted(() => ({ resolved: 'dark' }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: theme.resolved }) }))
vi.mock('@/lib/useShareCardMap', () => ({ useShareCardMap: () => ({ image: null, points: null, failed: false }) }))
vi.mock('@/lib/useShareCardGeocode', () => ({ useShareCardGeocode: () => ({ locationName: null }) }))
// jsdom decodes no image: a chosen photo loads as soon as it is picked.
// Each draw's run is kept, to see which card the preview drew.
const drawn = vi.hoisted(() => ({ runs: [] as unknown[] }))
vi.mock('@/lib/shareCard', async (load) => {
  const actual = await load<typeof import('@/lib/shareCard')>()
  return {
    ...actual,
    loadImage: () => Promise.resolve({ width: 1000, height: 800 }),
    renderShareCard: (...args: Parameters<typeof actual.renderShareCard>) => {
      drawn.runs.push(args[1].activity)
      return actual.renderShareCard(...args)
    },
  }
})

const RUN: ShareActivity = {
  id: '1', date: '2026-09-26', dayOfWeek: 'Saturday', description: 'Easy',
  distanceKm: 10, durationSeconds: 3453, paceSecPerKm: 344, avgHeartRate: 153, elevationGain: 40,
  route: [[7.7, 48.6], [7.71, 48.61]], hrZones: [],
}

function open(props: Partial<{ activity: ShareActivity; canShareFiles: boolean; canCopyImage: boolean }> = {}) {
  return render(
    <ShareCardModal activity={RUN} canShareFiles canCopyImage onClose={() => {}} {...props} />,
  )
}

const checked = (group: string) =>
  screen.getByRole('radiogroup', { name: group }).querySelector('[aria-checked="true"]')?.textContent

beforeEach(() => {
  drawn.runs = []
  localStorage.clear()
  theme.resolved = 'dark'
  URL.createObjectURL = () => 'blob:photo'
  URL.revokeObjectURL = () => {}
})

const REP_RUN: ShareActivity = {
  ...RUN,
  type: 'Threshold',
  reps: { count: 3, repSeconds: 480, paceSecPerKm: 274, paces: [275, 275, 274], target: { min: 270, max: 282 }, windows: [[0.2, 0.3], [0.4, 0.5], [0.6, 0.7]] },
}

const lastDrawn = () => drawn.runs.at(-1) as ShareActivity

describe('ShareCardModal', () => {
  it('offers Route, Stats and Photo, opening on Route when the run has one', () => {
    open()
    expect(screen.getAllByRole('radio').slice(0, 3).map((b) => b.textContent)).toEqual(['Route', 'Stats', 'Photo'])
    expect(checked('Design')).toBe('Route')
  })

  it('opens on Stats and drops Route for a run without GPS', () => {
    open({ activity: { ...RUN, route: null } })
    expect(screen.queryByRole('radio', { name: 'Route' })).toBeNull()
    expect(checked('Design')).toBe('Stats')
  })

  it('has no accent picker, light-mode switch or thumbnails left', () => {
    open()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByText('Accent')).toBeNull()
    expect(document.querySelectorAll('canvas')).toHaveLength(1)
  })

  it('opens the background on the app theme every time, a pick lasting only while the sheet is open', async () => {
    theme.resolved = 'light'
    const { unmount } = open()
    expect(checked('Background')).toBe('Light')
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(checked('Background')).toBe('Dark')
    unmount()
    open()
    expect(checked('Background')).toBe('Light')
  })

  it('shows Share with Copy image beside it, or Download where files cannot be shared', () => {
    const { unmount } = open()
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy image' })).toBeTruthy()
    unmount()
    open({ canShareFiles: false, canCopyImage: false })
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copy image' })).toBeNull()
  })

  it('has no page dots under the preview: the design picker comes straight after it', () => {
    open()
    expect(screen.getByTestId('share-preview').nextElementSibling?.getAttribute('aria-label')).toBe('Design')
  })

  // A card that changes height per tab makes the controls under it jump.
  it('keeps one 4:5 card box, and one option row, on every tab', async () => {
    open()
    // jsdom drops a min() width; the box's ratio, margin and corners are what it can read.
    const box = () => {
      const { aspectRatio, marginTop, borderRadius } = screen.getByTestId('share-preview').style
      return { aspectRatio, marginTop, borderRadius }
    }
    const first = box()
    expect(first.aspectRatio).toBe('4 / 5')
    for (const tab of ['Stats', 'Photo', 'Route']) {
      await userEvent.click(screen.getByRole('radio', { name: tab }))
      expect(box()).toEqual(first)
      expect(screen.getByTestId('share-options').style.minHeight).toBe('52px')
    }
  })

  it('makes the empty photo frame the picker, and shares nothing until a photo is chosen', async () => {
    open()
    await userEvent.click(screen.getByRole('radio', { name: 'Photo' }))
    expect(screen.getByTestId('share-photo-picker').textContent).toBe('Choose photoThis frame is the exact crop')
    // The option row offers the same choice, where Dark and Light sit on the other tabs.
    expect(within(screen.getByTestId('share-options')).getByRole('button', { name: 'Choose photo' }).style.height).toBe('44px')
    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Copy image' })).toBeDisabled()
    // A photo covers the whole card: there is no background to pick.
    expect(screen.queryByRole('radiogroup', { name: 'Background' })).toBeNull()

    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['x'], 'run.jpg', { type: 'image/jpeg' }))
    const replace = await screen.findByRole('button', { name: 'Replace photo' })
    expect(replace.style.height).toBe('44px')
    expect(screen.queryByTestId('share-photo-picker')).toBeNull()
    expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Copy image' })).toBeEnabled()
  })

  it('sizes the sheet to what it holds, the buttons right under the options', () => {
    open()
    const sheet = screen.getByTestId('share-sheet')
    expect(sheet.className).toContain('max-h-full')
    expect(sheet.className).not.toMatch(/(^|\s)h-full/)
    expect(sheet.className).toContain('rounded-t-[var(--radius-sheet-large)]')
    expect(screen.getByTestId('share-options').nextElementSibling?.textContent).toContain('Share')
  })

  it('is the sheets\' glass, the scroll inside it, the card opaque', () => {
    open()
    const sheet = screen.getByTestId('share-sheet')
    expect(sheet.className).toMatch(/\blg lg-sheet\b/)
    expect(sheet.style.background).toBe('')
    expect([...sheet.querySelectorAll(':scope > i')].map((i) => i.className)).toEqual(['lg-blur', 'lg-edge', 'lg-tint'])
    expect(sheet.className).not.toContain('overflow-y-auto')
    expect(screen.getByTestId('share-sheet-body').className).toContain('overflow-y-auto')
    expect(screen.getByTestId('share-preview').closest('.lg')).toBe(sheet)
    expect(screen.getByTestId('share-preview').querySelector('canvas')).not.toBeNull()
  })

  // The accent is the Share button's.
  it('draws both pickers in the app\'s segmented style, the pick lifted, never the accent', () => {
    open()
    for (const group of ['Design', 'Background']) {
      const picker = screen.getByRole('radiogroup', { name: group })
      expect(picker.className).toContain('bg-[var(--segmented-track)]')
      const pick = picker.querySelector<HTMLElement>('[aria-checked="true"]')!
      expect(pick.className).toContain('bg-[var(--segmented-pill)]')
      expect(pick.className).toContain('text-foreground')
      expect(pick.getAttribute('style') ?? '').not.toContain('accent')
      for (const option of picker.querySelectorAll('[role="radio"]')) expect(option.className).toContain('hit-44')
    }
  })

  it('spans the design row in equal segments, each label centred in its own', () => {
    open()
    const picker = screen.getByRole('radiogroup', { name: 'Design' })
    expect(picker.className).toMatch(/(^|\s)flex(\s|$)/)
    expect(picker.className).not.toMatch(/(^|\s)grid(\s|$)/)
    expect(picker.className).toContain('w-full')
    const options = within(picker).getAllByRole('radio')
    expect(options).toHaveLength(3)
    for (const option of options) {
      expect(option.className).toContain('flex-[1_1_0%]')
      expect(option.className).toContain('min-w-0')
      expect(option.className).toContain('justify-center')
    }
  })

  it('gives the close button a 44 pt target', () => {
    open()
    const close = screen.getByRole('button', { name: t.activity.shareCard.close })
    expect(close.className).toContain('h-11')
    expect(close.className).toContain('w-11')
    expect(close.className).toContain('bg-[var(--sheet-fill)]')
  })

  it('offers no VO₂max badge', () => {
    open()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByTestId('share-sheet').textContent).not.toContain('VO₂max')
  })

  // So an interval session can be shared as an easy run's card.
  it("offers an interval session's rep pace as a switch, on every tab; off, the card is drawn without the reps", async () => {
    open({ activity: REP_RUN })
    const toggle = screen.getByRole('switch', { name: 'Rep pace' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(lastDrawn().reps?.count).toBe(3)

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(lastDrawn().reps).toBeNull()
    expect(lastDrawn().route).toEqual(REP_RUN.route)

    // Still there, and still off, on Stats and Photo, which draw the rep pace too.
    await userEvent.click(screen.getByRole('radio', { name: 'Stats' }))
    expect(screen.getByRole('switch', { name: 'Rep pace' })).toHaveAttribute('aria-checked', 'false')
    expect(lastDrawn().reps).toBeNull()

    await userEvent.click(screen.getByRole('switch', { name: 'Rep pace' }))
    expect(lastDrawn().reps?.count).toBe(3)
  })

  it('opens the rep pace on every time, like the background', async () => {
    const { unmount } = open({ activity: REP_RUN })
    await userEvent.click(screen.getByRole('switch', { name: 'Rep pace' }))
    unmount()
    open({ activity: REP_RUN })
    expect(screen.getByRole('switch', { name: 'Rep pace' })).toHaveAttribute('aria-checked', 'true')
  })

  it('offers no rep-pace switch on a run without reps', () => {
    open()
    expect(screen.queryByRole('switch', { name: 'Rep pace' })).toBeNull()
    expect(screen.queryByTestId('share-reps')).toBeNull()
  })
})
