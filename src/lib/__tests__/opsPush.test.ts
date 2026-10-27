import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendPush } = vi.hoisted(() => ({ sendPush: vi.fn() }))

vi.mock('@/lib/sendPushNotification', () => ({ sendPush }))

const { opsSource, opsStrings, sendOpsPush } = await import('../opsPush')

const URL = 'https://owner.example.com/api/internal/ops-push'
const ALERT = { title: 'Token expiring', body: 'dataActions' }

describe('sendOpsPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GITHUB_SYNC_PROFILE', 'kestrel')
    sendPush.mockResolvedValue({ sent: 1, failed: 0 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('pushes to this deployment’s own devices where no operator deployment is configured', async () => {
    expect(await sendOpsPush(ALERT)).toEqual({ forwarded: false })
    expect(sendPush).toHaveBeenCalledWith('always', ALERT)
  })

  it('keeps pushing locally when only one half of the forwarding is set', async () => {
    vi.stubEnv('OPS_PUSH_URL', URL)

    expect(await sendOpsPush(ALERT)).toEqual({ forwarded: false })
    expect(sendPush).toHaveBeenCalledOnce()
  })

  it('forwards to the operator’s deployment, named by the athlete whose deployment raised it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('OPS_PUSH_URL', URL)
    vi.stubEnv('OPS_PUSH_SECRET', 'ops-secret')

    expect(await sendOpsPush(ALERT)).toEqual({ forwarded: true })
    expect(sendPush).not.toHaveBeenCalled()

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(URL)
    expect((init as { headers: Record<string, string> }).headers['x-ops-secret']).toBe('ops-secret')
    expect(JSON.parse((init as { body: string }).body)).toEqual({ title: 'Token expiring', body: 'dataActions', from: 'kestrel' })
  })

  it('forwards the link as this deployment’s absolute URL, with the tag', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('OPS_PUSH_URL', URL)
    vi.stubEnv('OPS_PUSH_SECRET', 'ops-secret')
    vi.stubEnv('APP_URL', 'https://kestrel.example.com')

    await sendOpsPush({ ...ALERT, link: '/settings', tag: 'token-expiry' })

    expect(JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body)).toEqual({
      ...ALERT,
      from: 'kestrel',
      link: 'https://kestrel.example.com/settings',
      tag: 'token-expiry',
    })
  })

  it('throws on a refusal, so the alert is not recorded as delivered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    vi.stubEnv('OPS_PUSH_URL', URL)
    vi.stubEnv('OPS_PUSH_SECRET', 'ops-secret')

    await expect(sendOpsPush(ALERT)).rejects.toThrow('503')
  })
})

describe('opsSource', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('names the deployment by its sync profile', () => {
    vi.stubEnv('GITHUB_SYNC_PROFILE', 'kestrel')

    expect(opsSource()).toBe('kestrel')
  })

  it('falls back to the product name on a deployment with no profile', () => {
    vi.stubEnv('GITHUB_SYNC_PROFILE', '  ')

    expect(opsSource()).toBe('RunOmics')
  })
})

describe('operator copy', () => {
  it('is English whatever the deployment speaks', () => {
    expect(opsStrings.workflowFailed.title('sync')).toBe('sync failed')
    expect(opsStrings.coachBlock.title).toBe('Coaching block')
  })
})
