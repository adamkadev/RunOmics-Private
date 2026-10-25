import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { sendPush } = vi.hoisted(() => ({ sendPush: vi.fn() }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPush }))

const { POST } = await import('../route')

const SECRET = 'test-secret'
const RUN_URL = 'https://github.com/adamkadev/RunOmics-Private/actions/runs/35866357223'

// A new address per request: the guard's per-IP limit is 20 a minute, and
// this file sends more than that.
let caller = 0

function request(body: unknown, { secret = SECRET }: { secret?: string | null } = {}) {
  return new NextRequest('https://example.com/api/internal/workflow-failure', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.${Math.floor(++caller / 250)}.${caller % 250}`,
      ...(secret === null ? {} : { 'x-internal-secret': secret }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function rejects(body: unknown): Promise<string> {
  const res = await POST(request(body))
  expect(res.status).toBe(400)
  return ((await res.json()) as { error: string }).error
}

describe('POST /api/internal/workflow-failure', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    sendPush.mockReset()
    sendPush.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('pushes which workflow failed and where to look', async () => {
    const res = await POST(request({ workflow: 'Daily Session Reminder', runUrl: RUN_URL }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: true })
    expect(sendPush).toHaveBeenCalledWith('always', 'Daily Session Reminder failed', `Open the run: ${RUN_URL}`)
  })

  it('takes a workflow name in any script', async () => {
    await POST(request({ workflow: 'Synchronisation nocturne · données', runUrl: RUN_URL }))

    expect(sendPush).toHaveBeenCalledWith('always', 'Synchronisation nocturne · données failed', expect.any(String))
  })

  it('refuses a caller without the internal secret before reading the body', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await POST(request({ workflow: 'Sync', runUrl: RUN_URL }, { secret: null }))

    expect(res.status).toBe(401)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('rejects a body that is not a JSON object', async () => {
    expect(await rejects('not json')).toBe('body must be a JSON object')
    expect(await rejects([{ workflow: 'Sync', runUrl: RUN_URL }])).toBe('body must be a JSON object')
    expect(await rejects(null)).toBe('body must be a JSON object')
    expect(sendPush).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', undefined],
    ['not a string', 42],
    ['empty', ''],
    ['only spaces', '   '],
    ['too long', 'W'.repeat(201)],
    ['a line break that would split the title', 'Sync\nfailed'],
    ['a control character', 'Sync\u0007'],
    ['a bidi override that could disguise it', 'Sync ‮deliaf'],
  ])('rejects a workflow name that is %s', async (_, workflow) => {
    expect(await rejects({ workflow, runUrl: RUN_URL })).toMatch(/^workflow must be/)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('accepts a workflow name of exactly 200 characters', async () => {
    expect((await POST(request({ workflow: 'W'.repeat(200), runUrl: RUN_URL }))).status).toBe(200)
  })

  it.each([
    ['missing', undefined],
    ['not a string', ['https://github.com/']],
    ['plain http', 'http://github.com/adamkadev/RunOmics-Private/actions/runs/1'],
    ['another host that starts the same way', 'https://github.com.evil.example/actions/runs/1'],
    ['another host with github.com in the query', 'https://evil.example/?next=https://github.com/'],
    ['bare github.com with nothing after it', 'https://github.com/'],
    ['too long', `https://github.com/${'a'.repeat(182)}`],
    ['a space', 'https://github.com/adamkadev/RunOmics-Private/actions/runs/1 click here'],
    ['a line break', 'https://github.com/adamkadev/RunOmics-Private/actions/runs/1\nmore'],
  ])('rejects a run URL that is %s', async (_, runUrl) => {
    expect(await rejects({ workflow: 'Sync', runUrl })).toMatch(/^runUrl must/)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('accepts a run URL of exactly 200 characters', async () => {
    const runUrl = `https://github.com/${'a'.repeat(181)}`
    expect(runUrl).toHaveLength(200)

    expect((await POST(request({ workflow: 'Sync', runUrl }))).status).toBe(200)
  })

  it('answers 500 when the push itself fails, so the workflow step shows it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    sendPush.mockRejectedValue(new Error('FCM is down'))

    expect((await POST(request({ workflow: 'Sync', runUrl: RUN_URL }))).status).toBe(500)
  })
})
