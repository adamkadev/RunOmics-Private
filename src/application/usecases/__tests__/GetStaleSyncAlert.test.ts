import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getLastSyncedAt, getLastStaleSyncState, saveLastStaleSyncState } = vi.hoisted(() => ({
  getLastSyncedAt: vi.fn(),
  getLastStaleSyncState: vi.fn(),
  saveLastStaleSyncState: vi.fn(),
}))

vi.mock('@/infrastructure/repositories/FirestoreConfigRepository', () => ({
  getLastStaleSyncState,
  saveLastStaleSyncState,
}))

vi.mock('../GetSyncStatus', () => ({ getLastSyncedAt }))

const { getStaleSyncAlert } = await import('../GetStaleSyncAlert')

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()

describe('getStaleSyncAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLastStaleSyncState.mockResolvedValue(null)
    saveLastStaleSyncState.mockResolvedValue(undefined)
  })

  it('null, and nothing to store, when there is no recorded sync yet', async () => {
    getLastSyncedAt.mockReturnValue(null)

    const { alert, commit } = await getStaleSyncAlert()
    await commit()

    expect(alert).toBeNull()
    expect(saveLastStaleSyncState).not.toHaveBeenCalled()
  })

  it('null when the last sync is within the stale window', async () => {
    getLastSyncedAt.mockReturnValue(hoursAgo(10))

    expect((await getStaleSyncAlert()).alert).toBeNull()
  })

  it('fires once when sync falls past the stale threshold', async () => {
    getLastSyncedAt.mockReturnValue(hoursAgo(80))

    expect((await getStaleSyncAlert()).alert?.hoursSinceSync).toBe(80)
  })

  it('does not re-alert while still stale from a previous check', async () => {
    getLastSyncedAt.mockReturnValue(hoursAgo(80))
    getLastStaleSyncState.mockResolvedValue({ alerted: true })

    expect((await getStaleSyncAlert()).alert).toBeNull()
  })

  it('stores nothing until the caller commits, so a push that fails is offered again', async () => {
    getLastSyncedAt.mockReturnValue(hoursAgo(80))

    const { alert, commit } = await getStaleSyncAlert()

    expect(alert).not.toBeNull()
    expect(saveLastStaleSyncState).not.toHaveBeenCalled()

    await commit()
    expect(saveLastStaleSyncState).toHaveBeenCalledWith({ alerted: true })
  })

  it('re-arms once a sync lands again', async () => {
    getLastSyncedAt.mockReturnValue(hoursAgo(2))
    getLastStaleSyncState.mockResolvedValue({ alerted: true })

    await (await getStaleSyncAlert()).commit()

    expect(saveLastStaleSyncState).toHaveBeenCalledWith({ alerted: false })
  })
})
