import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { keepJobEvent } = vi.hoisted(() => ({ keepJobEvent: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreJobEventRepository', () => ({ keepJobEvent }))

const { handleInternalRoute, scheduledRoute } = await import('../internalRoute')

const SECRET = 'test-secret'
const CRON_SECRET = 'cron-secret'

const manual = () => new NextRequest('https://example.com/api/internal/x', { method: 'POST', headers: { 'x-internal-secret': SECRET } })
const cron = () => new NextRequest('https://example.com/api/internal/x', { headers: { authorization: `Bearer ${CRON_SECRET}` } })
const kept = () => keepJobEvent.mock.calls.map(([event]) => event)

describe('the trace of internal routes', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.stubEnv('CRON_SECRET', CRON_SECRET)
    vi.stubEnv('FIREBASE_PROJECT_ID', 'demo-runomics')
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', 'localhost:8080')
    keepJobEvent.mockReset().mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('keeps every scheduled run with its trigger and outcome, and nothing of its body', async () => {
    const { GET, POST } = scheduledRoute('daily-session', async (trigger) =>
      NextResponse.json(trigger === 'cron' ? { skipped: 'not 08:xx in Paris' } : { sent: true, restDay: false })
    )

    await GET(cron())
    await POST(manual())

    expect(kept()).toEqual([
      { at: expect.any(String), route: 'daily-session', trigger: 'cron', outcome: 'skipped', status: 200 },
      { at: expect.any(String), route: 'daily-session', trigger: 'manual', outcome: 'sent', status: 200 },
    ])
  })

  it('keeps the class name of what a scheduled run threw', async () => {
    const { GET } = scheduledRoute('weekly-digest', async () => {
      throw new TypeError('cannot read token abc')
    })

    expect((await GET(cron())).status).toBe(500)
    expect(kept()).toEqual([{ at: expect.any(String), route: 'weekly-digest', trigger: 'cron', outcome: 'error', status: 500, error: 'TypeError' }])
  })

  it('keeps a sync call only when it answers 5xx', async () => {
    await handleInternalRoute('pr-check', manual(), async () => NextResponse.json({ sent: 1 }))
    await handleInternalRoute('wellness', manual(), async () => NextResponse.json({ error: 'Firestore did not answer' }, { status: 503 }))

    expect(kept()).toEqual([{ at: expect.any(String), route: 'wellness', trigger: 'sync', outcome: 'error', status: 503 }])
  })

  it('never keeps a probe, nor a refused call', async () => {
    await handleInternalRoute('health', manual(), async () => NextResponse.json({ status: 'stale' }, { status: 503 }), undefined, { probe: true })
    const { GET } = scheduledRoute('nightly-sync', async () => NextResponse.json({ dispatched: true }))
    await GET(new NextRequest('https://example.com/api/internal/x', { headers: { authorization: 'Bearer wrong' } }))

    expect(keepJobEvent).not.toHaveBeenCalled()
  })

  it('answers as the handler did when the trace cannot be kept', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    keepJobEvent.mockRejectedValue(new Error('Firestore is down'))
    const { GET } = scheduledRoute('nightly-sync', async () => NextResponse.json({ dispatched: true }))

    const res = await GET(cron())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dispatched: true })
  })

  it('keeps nothing on a deployment without Firestore', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '')
    const { GET } = scheduledRoute('nightly-sync', async () => NextResponse.json({ dispatched: true }))
    await GET(cron())
    expect(keepJobEvent).not.toHaveBeenCalled()
  })
})
