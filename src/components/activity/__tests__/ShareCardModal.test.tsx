import { render, screen } from '@testing-library/react'
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

const RUN: ShareActivity = {
  id: '1', date: '2026-09-26', dayOfWeek: 'Saturday', description: 'Easy',
  distanceKm: 10, durationSeconds: 3453, paceSecPerKm: 344, avgHeartRate: 153, elevationGain: 40,
  route: [[7.7, 48.6], [7.71, 48.61]], paceSamples: null, hrZones: [],
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

  it('shows Share with Copy beside it, or Download where files cannot be shared', () => {
    const { unmount } = open()
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
    unmount()
    open({ canShareFiles: false, canCopyImage: false })
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull()
  })

  it('fills the sheet to its container: no safe-area padding and no glass', () => {
    open()
    const sheet = screen.getByTestId('share-sheet')
    expect(sheet.className).toContain('h-full')
    expect(sheet.style.paddingTop).toBe('')
    expect(sheet.style.background).toBe('var(--background)')
    expect(sheet.style.backdropFilter ?? '').toBe('')
  })

  it('offers the VO₂max grade badge off by default, and only with a grade (v5.3)', async () => {
    const { unmount } = open()
    expect(screen.queryByRole('switch', { name: t.vo2Grade.shareBadge })).toBeNull()
    unmount()
    render(<ShareCardModal activity={RUN} vo2Grade="A" canShareFiles canCopyImage onClose={() => {}} />)
    const toggle = screen.getByRole('switch', { name: t.vo2Grade.shareBadge })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    await userEvent.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('true')
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

  // Design review, Oct 2026: off, the badge switch had no track to see.
  it('draws the badge switch as the app\'s one switch, its off track in line-2', async () => {
    render(<ShareCardModal activity={RUN} vo2Grade="A" canShareFiles canCopyImage onClose={() => {}} />)
    const toggle = screen.getByRole('switch', { name: t.vo2Grade.shareBadge })
    expect(toggle.className).toContain('bg-[var(--line-2)]')
    expect(toggle.className).toContain('hit-44')
    await userEvent.click(toggle)
    expect(toggle.className).toContain('bg-accent')
  })

  it('gives the close button a 44 pt target', () => {
    open()
    expect(screen.getByRole('button', { name: t.activity.shareCard.close }).className).toContain('hit-44')
  })
})
