import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { readSyncGate, dispatchSync, sendPush } = vi.hoisted(() => ({
  readSyncGate: vi.fn(),
  dispatchSync: vi.fn(),
  sendPush: vi.fn(),
}))

vi.mock('@/lib/githubSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/githubSync')>()),
  readSyncGate,
  dispatchSync,
}))
vi.mock('@/lib/sendPushNotification', () => ({ sendPush }))

const { GET, POST } = await import('../route')

const CRON_SECRET = 'cron-secret'
const INTERNAL_SECRET = 'internal-secret'

function cron(secret: string | null = CRON_SECRET) {
  return new NextRequest('https://example.com/api/internal/nightly-sync', {
    headers: secret === null ? {} : { authorization: `Bearer ${secret}` },
  })
}

describe('/api/internal/nightly-sync', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET)
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', INTERNAL_SECRET)
    vi.stubEnv('GITHUB_SYNC_TOKEN', 'token')
    vi.stubEnv('GITHUB_SYNC_REPO', 'owner/repo')
    vi.stubEnv('GITHUB_SYNC_PROFILE', 'runner')
    vi.stubEnv('OPS_PUSH_URL', '')
    vi.clearAllMocks()
    readSyncGate.mockResolvedValue({ kind: 'open' })
    dispatchSync.mockResolvedValue({ ok: true })
    sendPush.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('dispatches this deployment’s nightly sync on Vercel Cron’s call', async () => {
    const res = await GET(cron())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dispatched: true, profile: 'runner' })
    expect(dispatchSync).toHaveBeenCalledWith(expect.objectContaining({ repo: 'owner/repo', profile: 'runner' }), 'nightly')
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('runs by hand with the internal secret', async () => {
    const res = await POST(
      new NextRequest('https://example.com/api/internal/nightly-sync', {
        method: 'POST',
        headers: { 'x-internal-secret': INTERNAL_SECRET },
      })
    )

    expect(res.status).toBe(200)
    expect(dispatchSync).toHaveBeenCalledTimes(1)
  })

  it('refuses a cron call without the cron secret', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect((await GET(cron('wrong'))).status).toBe(401)
    expect((await GET(cron(null))).status).toBe(401)
    expect(dispatchSync).not.toHaveBeenCalled()
  })

  it('refuses every cron call when the deployment has no cron secret', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('CRON_SECRET', '')

    expect((await GET(cron(''))).status).toBe(401)
    expect(dispatchSync).not.toHaveBeenCalled()
  })

  it('names what is missing when the sync is not configured', async () => {
    vi.stubEnv('GITHUB_SYNC_TOKEN', '')

    const res = await GET(cron())

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Sync is not configured: GITHUB_SYNC_TOKEN unset' })
    expect(dispatchSync).not.toHaveBeenCalled()
  })

  it('skips the dispatch while a sync is already running', async () => {
    readSyncGate.mockResolvedValue({ kind: 'running', since: '2026-10-27T00:58:00Z' })

    const res = await GET(cron())

    expect(await res.json()).toEqual({ skipped: 'a sync is already running', since: '2026-10-27T00:58:00Z' })
    expect(dispatchSync).not.toHaveBeenCalled()
  })

  it('pushes the operator when GitHub refuses the dispatch', async () => {
    dispatchSync.mockResolvedValue({ ok: false, status: 401 })

    const res = await GET(cron())

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'GitHub refused the dispatch (401)' })
    expect(sendPush).toHaveBeenCalledWith('always', {
      title: 'Nightly sync did not start',
      body: 'GitHub refused its dispatch (401). Check the Sync button token and repository in Vercel.',
      link: '/settings',
      tag: 'sync-dispatch-refused',
    })
  })

  it('forwards the refusal to the operator’s deployment when one is set', async () => {
    dispatchSync.mockResolvedValue({ ok: false, status: 403 })
    vi.stubEnv('OPS_PUSH_URL', 'https://ops.example/api/internal/ops-push')
    vi.stubEnv('OPS_PUSH_SECRET', 'ops-secret')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))

    expect((await GET(cron())).status).toBe(502)
    expect(sendPush).not.toHaveBeenCalled()
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      title: 'Nightly sync did not start',
      body: 'GitHub refused its dispatch (403). Check the Sync button token and repository in Vercel.',
      from: 'runner',
      tag: 'sync-dispatch-refused',
    })
  })
})
