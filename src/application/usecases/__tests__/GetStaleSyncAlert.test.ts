import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/infrastructure/repositories/FirestoreConfigRepository', () => ({
  getLastStaleSyncState: vi.fn(),
  saveLastStaleSyncState: vi.fn(),
}))

vi.mock('../GetSyncStatus', () => ({
  getLastSyncedAt: vi.fn(),
}))

describe('getStaleSyncAlert', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('null when there is no recorded sync yet', async () => {
    const { getLastSyncedAt } = await import('../GetSyncStatus')
    vi.mocked(getLastSyncedAt).mockReturnValue(null)

    const { getStaleSyncAlert } = await import('../GetStaleSyncAlert')
    expect(await getStaleSyncAlert()).toBeNull()
  })

  it('null when the last sync is within the stale window', async () => {
    const { getLastSyncedAt } = await import('../GetSyncStatus')
    const { getLastStaleSyncState } = await import('@/infrastructure/repositories/FirestoreConfigRepository')
    vi.mocked(getLastSyncedAt).mockReturnValue(new Date(Date.now() - 10 * 3_600_000).toISOString())
    vi.mocked(getLastStaleSyncState).mockResolvedValue(null)

    const { getStaleSyncAlert } = await import('../GetStaleSyncAlert')
    expect(await getStaleSyncAlert()).toBeNull()
  })

  it('fires once when sync falls past the stale threshold', async () => {
    const { getLastSyncedAt } = await import('../GetSyncStatus')
    const { getLastStaleSyncState } = await import('@/infrastructure/repositories/FirestoreConfigRepository')
    vi.mocked(getLastSyncedAt).mockReturnValue(new Date(Date.now() - 80 * 3_600_000).toISOString())
    vi.mocked(getLastStaleSyncState).mockResolvedValue(null)

    const { getStaleSyncAlert } = await import('../GetStaleSyncAlert')
    const alert = await getStaleSyncAlert()
    expect(alert?.hoursSinceSync).toBe(80)
  })

  it('does not re-alert while still stale from a previous check', async () => {
    const { getLastSyncedAt } = await import('../GetSyncStatus')
    const { getLastStaleSyncState } = await import('@/infrastructure/repositories/FirestoreConfigRepository')
    vi.mocked(getLastSyncedAt).mockReturnValue(new Date(Date.now() - 80 * 3_600_000).toISOString())
    vi.mocked(getLastStaleSyncState).mockResolvedValue({ alerted: true })

    const { getStaleSyncAlert } = await import('../GetStaleSyncAlert')
    expect(await getStaleSyncAlert()).toBeNull()
  })
})
