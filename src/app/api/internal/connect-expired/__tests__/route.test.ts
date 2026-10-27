import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { sendPush } = vi.hoisted(() => ({ sendPush: vi.fn() }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPush }))

const { POST } = await import('../route')

const SECRET = 'test-secret'

let caller = 0

function request(body: unknown, { secret = SECRET }: { secret?: string | null } = {}) {
  return new NextRequest('https://example.com/api/internal/connect-expired', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.1.0.${++caller}`,
      ...(secret === null ? {} : { 'x-internal-secret': secret }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/internal/connect-expired', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    sendPush.mockReset()
    sendPush.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('pushes the operator the day Connect stopped and where the runbook is', async () => {
    const res = await POST(request({ since: '2026-11-03' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: true })
    expect(sendPush).toHaveBeenCalledWith('always', {
      title: 'Garmin Connect has stopped',
      body: expect.stringContaining('expired on 2026-11-03'),
      link: '/settings',
      tag: 'connect-expired',
    })
    expect(sendPush.mock.calls[0]![1].body).toContain('docs/data-and-sync.md')
  })

  it('forwards it to the operator’s deployment when this one belongs to another athlete', async () => {
    vi.stubEnv('OPS_PUSH_URL', 'https://operator.example/api/internal/ops-push')
    vi.stubEnv('OPS_PUSH_SECRET', 'ops-secret')
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))

    await POST(request({ since: '2026-11-03' }))

    expect(sendPush).not.toHaveBeenCalled()
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toMatchObject({ title: 'Garmin Connect has stopped', tag: 'connect-expired' })
    fetch.mockRestore()
  })

  it.each([{}, { since: '3 Nov' }, { since: '2026-13-45' }, 'not json', null])('refuses %j without pushing', async (body) => {
    const res = await POST(request(body))

    expect(res.status).toBe(400)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('refuses a caller without the internal secret', async () => {
    const res = await POST(request({ since: '2026-11-03' }, { secret: null }))

    expect(res.status).toBe(401)
    expect(sendPush).not.toHaveBeenCalled()
  })
})
