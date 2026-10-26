import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { sendPush } = vi.hoisted(() => ({ sendPush: vi.fn() }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPush }))

const { POST } = await import('../route')

const SECRET = 'ops-secret'

let caller = 0

function request(body: unknown, { secret = SECRET }: { secret?: string | null } = {}) {
  return new NextRequest('https://example.com/api/internal/ops-push', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.1.${Math.floor(++caller / 250)}.${caller % 250}`,
      ...(secret === null ? {} : { 'x-ops-secret': secret }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const ALERT = { title: 'Token expiring', body: 'Garmin, in 9 days', from: 'kestrel' }

describe('POST /api/internal/ops-push', () => {
  beforeEach(() => {
    vi.stubEnv('OPS_PUSH_SECRET', SECRET)
    sendPush.mockReset()
    sendPush.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('names the deployment the alert came from', async () => {
    expect(await (await POST(request(ALERT))).json()).toEqual({ sent: true })
    expect(sendPush).toHaveBeenCalledWith('always', 'kestrel · Token expiring', 'Garmin, in 9 days')
  })

  it('refuses a caller holding the wrong ops secret', async () => {
    expect((await POST(request(ALERT, { secret: 'wrong' }))).status).toBe(401)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('refuses a caller with no ops secret at all', async () => {
    expect((await POST(request(ALERT, { secret: null }))).status).toBe(401)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('answers 401 while this deployment has no ops secret configured', async () => {
    vi.stubEnv('OPS_PUSH_SECRET', '')

    expect((await POST(request(ALERT))).status).toBe(401)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('rejects a body that is not a JSON object', async () => {
    expect((await POST(request('["Token expiring"]'))).status).toBe(400)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('rejects a line carrying control or bidi characters', async () => {
    expect((await POST(request({ ...ALERT, title: 'Token‮expiring' }))).status).toBe(400)
    expect((await POST(request({ ...ALERT, body: 'line\nbreak' }))).status).toBe(400)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('rejects an empty or over-long field', async () => {
    expect((await POST(request({ ...ALERT, from: '  ' }))).status).toBe(400)
    expect((await POST(request({ ...ALERT, title: 'x'.repeat(101) }))).status).toBe(400)
    expect((await POST(request({ ...ALERT, body: 'x'.repeat(301) }))).status).toBe(400)
    expect(sendPush).not.toHaveBeenCalled()
  })
})
