import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getClientErrorDigest, sendOpsPush } = vi.hoisted(() => ({ getClientErrorDigest: vi.fn(), sendOpsPush: vi.fn() }))

vi.mock('@/application/usecases/ClientErrors', () => ({ getClientErrorDigest }))
vi.mock('@/lib/opsPush', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/opsPush')>()), sendOpsPush }))

const { POST } = await import('../route')

const SECRET = 'test-secret'
const request = () =>
  new NextRequest('https://example.com/api/internal/client-error-check', { method: 'POST', headers: { 'x-internal-secret': SECRET } })

const phoneError = { at: '2026-10-27T07:00:00.000Z', source: 'error', message: 'TypeError: x is undefined', page: '/', build: 'abc', device: 'iOS' }
const serverError = { at: '2026-10-27T02:00:00.000Z', route: 'ai-insights', trigger: 'sync', outcome: 'error', status: 500, error: 'TypeError' }

describe('POST /api/internal/client-error-check', () => {
  const commit = vi.fn(async () => {})

  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.clearAllMocks()
    sendOpsPush.mockResolvedValue({ forwarded: false })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('counts the phone’s errors and the server’s in one push, then records them', async () => {
    getClientErrorDigest.mockResolvedValue({ fresh: [phoneError], serverErrors: [serverError], commit })

    expect(await (await POST(request())).json()).toEqual({ fresh: 1, serverErrors: 1 })
    expect(sendOpsPush).toHaveBeenCalledWith({
      title: '1 error on your phone · 1 server error',
      body: 'Latest: TypeError: x is undefined. Settings → Diagnostics has them all.',
      link: '/settings',
      tag: 'client-errors',
    })
    expect(commit).toHaveBeenCalled()
  })

  it('names the failed job by its route and error class when only the server failed', async () => {
    getClientErrorDigest.mockResolvedValue({ fresh: [], serverErrors: [serverError, { ...serverError, error: undefined, status: 503 }], commit })

    await POST(request())
    expect(sendOpsPush).toHaveBeenCalledWith(
      expect.objectContaining({ title: '2 server errors', body: 'Latest: ai-insights failed (TypeError). Settings → Diagnostics has them all.' })
    )
  })

  it('stays quiet with nothing new', async () => {
    getClientErrorDigest.mockResolvedValue({ fresh: [], serverErrors: [], commit })

    await POST(request())
    expect(sendOpsPush).not.toHaveBeenCalled()
    expect(commit).toHaveBeenCalled()
  })
})
