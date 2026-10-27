import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { readSyncGate, dispatchSync, requireOwner } = vi.hoisted(() => ({
  readSyncGate: vi.fn(),
  dispatchSync: vi.fn(),
  requireOwner: vi.fn(),
}))
vi.mock('@/lib/githubSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/githubSync')>()),
  readSyncGate,
  dispatchSync,
}))
vi.mock('@/lib/ownerRoute', () => ({
  handleOwnerRoute: async (_name: string, req: NextRequest, handler: () => Promise<Response>) => (await requireOwner(req)) ?? handler(),
}))

const { POST } = await import('../route')

const NOW = new Date('2026-10-27T09:00:00Z')

function dispatch() {
  return POST(new NextRequest('https://example.com/api/sync/dispatch', { method: 'POST' }))
}

describe('POST /api/sync/dispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.clearAllMocks()
    vi.stubEnv('GITHUB_SYNC_TOKEN', 'token')
    vi.stubEnv('GITHUB_SYNC_REPO', 'owner/data')
    requireOwner.mockResolvedValue(null)
    readSyncGate.mockResolvedValue({ kind: 'open' })
    dispatchSync.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('dispatches a quick sync and answers the time the status poll reads from', async () => {
    const res = await dispatch()

    expect(await res.json()).toEqual({ since: NOW.toISOString() })
    expect(dispatchSync).toHaveBeenCalledWith(expect.objectContaining({ repo: 'owner/data' }), 'quick')
  })

  it('answers the running sync’s start instead of dispatching a second one', async () => {
    readSyncGate.mockResolvedValue({ kind: 'running', since: '2026-10-27T08:58:00Z' })

    const res = await dispatch()

    expect(await res.json()).toEqual({ since: '2026-10-27T08:58:00Z', alreadyRunning: true })
    expect(dispatchSync).not.toHaveBeenCalled()
  })

  it.each([
    ['cooldown', 'Synced moments ago'],
    ['dailyCap', 'Daily sync limit reached'],
  ])('answers 429 with retry-after during the %s', async (kind, error) => {
    readSyncGate.mockResolvedValue({ kind, retryAfterSec: 120 })

    const res = await dispatch()

    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('120')
    expect(await res.json()).toEqual({ error, reason: kind, retryAfter: 120 })
    expect(dispatchSync).not.toHaveBeenCalled()
  })

  it('answers 502 when GitHub refuses the dispatch', async () => {
    dispatchSync.mockResolvedValue({ ok: false, status: 403 })

    const res = await dispatch()

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'GitHub refused the dispatch (403)' })
  })

  it('answers 503 naming what is unset when sync is not configured', async () => {
    vi.stubEnv('GITHUB_SYNC_TOKEN', '')

    const res = await dispatch()

    expect(res.status).toBe(503)
    expect((await res.json()).error).toContain('GITHUB_SYNC_TOKEN')
    expect(readSyncGate).not.toHaveBeenCalled()
  })

  it('reads no gate for a caller the owner guard refuses', async () => {
    requireOwner.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))

    expect((await dispatch()).status).toBe(403)
    expect(readSyncGate).not.toHaveBeenCalled()
  })
})
