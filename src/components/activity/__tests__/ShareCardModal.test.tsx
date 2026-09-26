import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShareActivity } from '@/lib/shareCardStats'
import { SHARE_THEME_KEY } from '@/lib/useShareCardPrefs'
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
})
