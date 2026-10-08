import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShareActivity } from '@/lib/shareCardStats'
import { SHARE_THEME_KEY } from '@/lib/useShareCardPrefs'
import { t } from '@/i18n'
import { ShareCardModal } from '../ShareCardModal'

const theme = vi.hoisted(() => ({ resolved: 'dark' }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: theme.resolved }) }))
vi.mock('@/lib/useShareCardMap', () => ({ useShareCardMap: () => ({ image: null, points: null, failed: false }) }))
vi.mock('@/lib/useShareCardGeocode', () => ({ useShareCardGeocode: () => ({ locationName: null }) }))
// jsdom decodes no image: a chosen photo loads as soon as it is picked.
vi.mock('@/lib/shareCard', async (load) => ({
  ...(await load<typeof import('@/lib/shareCard')>()),
  loadImage: () => Promise.resolve({ width: 1000, height: 800 }),
}))

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
  localStorage.clear()
  theme.resolved = 'dark'
  URL.createObjectURL = () => 'blob:photo'
  URL.revokeObjectURL = () => {}
})

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

  it('opens the background on the app theme and remembers a pick', async () => {
    theme.resolved = 'light'
    open()
    expect(checked('Background')).toBe('Light')
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(checked('Background')).toBe('Dark')
    expect(localStorage.getItem(SHARE_THEME_KEY)).toBe('dark')
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

  // Design review, Oct 2026: the segmented control is the only selector.
  it('has no page dots under the preview: the design picker comes straight after it', () => {
    open()
    expect(screen.getByTestId('share-preview').nextElementSibling?.getAttribute('aria-label')).toBe('Design')
  })

  // Design review, Oct 2026: the card changed height per tab and the controls under it jumped.
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

  // Design review, Oct 2026: a full-height sheet left ~300 px of nothing above the buttons.
  it('sizes the sheet to what it holds, the buttons right under the options, no glass', () => {
    open()
    const sheet = screen.getByTestId('share-sheet')
    expect(sheet.className).toContain('max-h-full')
    expect(sheet.className).not.toMatch(/(^|\s)h-full/)
    expect(sheet.style.background).toBe('var(--card)')
    expect(sheet.style.backdropFilter ?? '').toBe('')
    expect(screen.getByTestId('share-options').nextElementSibling?.textContent).toContain('Share')
  })

  // Design review, Oct 2026: the design picker was a filled accent pill, unlike
  // every other segmented control; the accent is the Share button's.
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

  it('gives the close button a 44 pt target', () => {
    open()
    const close = screen.getByRole('button', { name: t.activity.shareCard.close })
    expect([close.style.width, close.style.height]).toEqual(['44px', '44px'])
  })

  // At the owner's request: no VO₂max badge on a shared card, nor a switch for one.
  it('offers no VO₂max badge', () => {
    open()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByTestId('share-sheet').textContent).not.toContain('VO₂max')
  })
})
