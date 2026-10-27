import { beforeEach, describe, expect, it, vi } from 'vitest'

const { recentClientErrors, recentJobEvents, getLastClientErrorAlertState, saveLastClientErrorAlertState } = vi.hoisted(() => ({
  recentClientErrors: vi.fn(),
  recentJobEvents: vi.fn(),
  getLastClientErrorAlertState: vi.fn(),
  saveLastClientErrorAlertState: vi.fn(),
}))

vi.mock('@/infrastructure/integrations', () => ({ integrationStatus: () => ({ firebaseAdmin: true }) }))
vi.mock('@/infrastructure/repositories/FirestoreClientErrorRepository', () => ({ recentClientErrors, keepClientError: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreJobEventRepository', () => ({ recentJobEvents }))
vi.mock('@/infrastructure/repositories/FirestoreConfigRepository', () => ({ getLastClientErrorAlertState, saveLastClientErrorAlertState }))

const { getClientErrorDigest } = await import('../ClientErrors')

const job = (at: string, outcome: 'sent' | 'error') => ({ at, route: 'ai-insights', trigger: 'sync', outcome, status: outcome === 'error' ? 500 : 200 })

describe('getClientErrorDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recentClientErrors.mockResolvedValue([])
  })

  it('announces the server errors after the last mark, and moves the mark to the newest run', async () => {
    const failed = job('2026-10-27T02:00:00Z', 'error')
    recentJobEvents.mockResolvedValue([job('2026-10-27T06:00:00Z', 'sent'), failed, job('2026-10-26T02:00:00Z', 'error')])
    getLastClientErrorAlertState.mockResolvedValue({ lastAt: '2026-10-20T00:00:00Z', jobErrorAt: '2026-10-26T03:00:00Z' })

    const digest = await getClientErrorDigest()
    expect(digest.serverErrors).toEqual([failed])

    await digest.commit()
    expect(saveLastClientErrorAlertState).toHaveBeenCalledWith({ lastAt: '2026-10-20T00:00:00Z', jobErrorAt: '2026-10-27T06:00:00Z' })
  })

  it('only takes note of the server’s errors on a state saved before they were digested', async () => {
    recentJobEvents.mockResolvedValue([job('2026-10-27T02:00:00Z', 'error')])
    getLastClientErrorAlertState.mockResolvedValue({ lastAt: '2026-10-20T00:00:00Z' })

    const digest = await getClientErrorDigest()
    expect(digest.serverErrors).toEqual([])
    await digest.commit()
    expect(saveLastClientErrorAlertState).toHaveBeenCalledWith({ lastAt: '2026-10-20T00:00:00Z', jobErrorAt: '2026-10-27T02:00:00Z' })
  })
})
