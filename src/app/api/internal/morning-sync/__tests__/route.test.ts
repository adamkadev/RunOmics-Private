import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { HealthDay } from '@/domain/training/recovery'

const { readSyncGate, dispatchSync, health } = vi.hoisted(() => ({
  readSyncGate: vi.fn(),
  dispatchSync: vi.fn(),
  health: [] as HealthDay[],
}))

vi.mock('@/lib/githubSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/githubSync')>()),
  readSyncGate,
  dispatchSync,
}))
vi.mock('@/application/usecases/LoadData', () => ({ loadData: async () => {} }))
vi.mock('@/application/usecases/GetLoadRecovery', () => ({ getHealthHistory: () => health }))

const { GET } = await import('../route')

const CRON_SECRET = 'cron-secret'

const cron = () => new NextRequest('https://example.com/api/internal/morning-sync', { headers: { authorization: `Bearer ${CRON_SECRET}` } })

describe('/api/internal/morning-sync', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET)
    vi.stubEnv('GITHUB_SYNC_TOKEN', 'token')
    vi.stubEnv('GITHUB_SYNC_REPO', 'owner/repo')
    vi.stubEnv('GITHUB_SYNC_PROFILE', 'runner')
    vi.clearAllMocks()
    health.length = 0
    readSyncGate.mockResolvedValue({ kind: 'open' })
    dispatchSync.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('dispatches a quick sync for an athlete who sleeps with a tracker', async () => {
    health.push({ date: '2026-03-02', restingHr: 47 })
    const res = await GET(cron())

    expect(await res.json()).toEqual({ dispatched: true, profile: 'runner' })
    expect(dispatchSync).toHaveBeenCalledWith(expect.objectContaining({ profile: 'runner' }), 'quick')
  })

  it('leaves a deployment without a tracker alone', async () => {
    const res = await GET(cron())

    expect(await res.json()).toEqual({ skipped: 'no overnight tracker' })
    expect(dispatchSync).not.toHaveBeenCalled()
  })

  it('does not start a second run while one is going', async () => {
    health.push({ date: '2026-03-02', restingHr: 47 })
    readSyncGate.mockResolvedValue({ kind: 'running', since: '2026-03-02T07:40:00Z' })
    const res = await GET(cron())

    expect((await res.json()).skipped).toBe('a sync is already running')
    expect(dispatchSync).not.toHaveBeenCalled()
  })

  it('answers 502 when GitHub refuses', async () => {
    health.push({ date: '2026-03-02', restingHr: 47 })
    dispatchSync.mockResolvedValue({ ok: false, status: 403 })

    expect((await GET(cron())).status).toBe(502)
  })

  it('refuses a call without the cron secret', async () => {
    const res = await GET(new NextRequest('https://example.com/api/internal/morning-sync'))

    expect(res.status).toBe(401)
    expect(dispatchSync).not.toHaveBeenCalled()
  })
})
