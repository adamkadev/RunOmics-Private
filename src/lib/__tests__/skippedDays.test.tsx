import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { t } from '@/i18n'

const auth = vi.hoisted(() => ({ isOwner: true }))
const store = vi.hoisted(() => ({ readSkippedDays: vi.fn(), writeSkippedDay: vi.fn(), readCheckInDay: vi.fn(), writeCheckInDay: vi.fn(), readCheckInsSince: vi.fn() }))

vi.mock('@/lib/firebaseConfig', () => ({ isClientFirebaseConfigured: true }))
vi.mock('@/lib/useOwnerAuth', () => ({ useOwnerAuth: () => ({ user: null, isOwner: auth.isOwner, loading: false }) }))
vi.mock('@/lib/wellness', () => store)

async function fresh() {
  vi.resetModules()
  return import('../skippedDays')
}

beforeEach(() => {
  auth.isOwner = true
  localStorage.clear()
  store.readSkippedDays.mockReset().mockResolvedValue(new Map([['2026-10-21', 'ill']]))
  store.writeSkippedDay.mockReset().mockResolvedValue(undefined)
})

describe('skipped days', () => {
  it('reads the owner’s marks from Firestore, and moves this browser’s old ones there once, as rest', async () => {
    localStorage.setItem('runomics-skipped-days', JSON.stringify(['2026-10-14', '2026-10-21']))
    const { useSkippedDays } = await fresh()
    const { result } = renderHook(() => useSkippedDays())

    await waitFor(() => expect(result.current.get('2026-10-14')).toBe('rest'))
    expect(result.current.get('2026-10-21')).toBe('ill')
    expect(store.writeSkippedDay.mock.calls).toEqual([['2026-10-14', 'rest']])
    expect(localStorage.getItem('runomics-skipped-days')).toBeNull()
  })

  it('keeps the old marks in the browser, and on screen, when Firestore refuses them', async () => {
    localStorage.setItem('runomics-skipped-days', JSON.stringify(['2026-10-14']))
    store.writeSkippedDay.mockRejectedValue(new Error('offline'))
    const { useSkippedDays } = await fresh()
    const { result } = renderHook(() => useSkippedDays())

    await waitFor(() => expect(store.writeSkippedDay).toHaveBeenCalledWith('2026-10-14', 'rest'))
    expect(result.current.get('2026-10-21')).toBe('ill')
    expect(result.current.get('2026-10-14')).toBe('rest')
    expect(localStorage.getItem('runomics-skipped-days')).toBe(JSON.stringify(['2026-10-14']))
  })

  it('shows anyone but the owner nothing, and asks Firestore nothing', async () => {
    auth.isOwner = false
    const { useSkippedDays } = await fresh()
    const { result } = renderHook(() => useSkippedDays())

    expect(result.current.size).toBe(0)
    expect(store.readSkippedDays).not.toHaveBeenCalled()
  })

  it('puts a mark back when its write fails', async () => {
    const { setDaySkipped, useSkippedDays } = await fresh()
    const { result } = renderHook(() => useSkippedDays())
    await waitFor(() => expect(result.current.size).toBe(1))

    store.writeSkippedDay.mockRejectedValueOnce(new Error('offline'))
    await act(() => expect(setDaySkipped('2026-10-21', null)).rejects.toThrow('offline'))
    expect(result.current.get('2026-10-21')).toBe('ill')
  })
})

describe('marking a missed session skipped', () => {
  const missed = async () => {
    const { DoneDayCard } = await import('@/components/plan/PlanDayCard')
    render(<DoneDayCard date="2026-10-20" kind={null} title="Easy" planned="8 km" acts={[]} fit={null} />)
  }

  it('asks the owner why, and stores the reason on the day', async () => {
    store.readSkippedDays.mockResolvedValue(new Map())
    vi.resetModules()
    const user = userEvent.setup()
    await missed()

    await user.click(screen.getByTestId('skip-toggle'))
    await user.click(screen.getByTestId('skip-life'))
    expect(store.writeSkippedDay).toHaveBeenCalledWith('2026-10-20', 'life')
    expect(screen.getByTestId('skipped-mark').textContent).toBe(t.plan.dayCard.skippedFor(t.plan.dayCard.skipReasons.life))
  })

  it('offers nobody else the choice', async () => {
    auth.isOwner = false
    vi.resetModules()
    await missed()

    expect(screen.getByTestId('done-line').textContent).toContain(t.sessionState.missed)
    expect(screen.queryByTestId('skip-toggle')).toBeNull()
  })
})
