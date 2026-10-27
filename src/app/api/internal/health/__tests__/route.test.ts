import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { loadData, getAllActivities, getLastSyncedAt } = vi.hoisted(() => ({
  loadData: vi.fn(),
  getAllActivities: vi.fn(),
  getLastSyncedAt: vi.fn(),
}))

vi.mock('@/application/usecases/LoadData', () => ({
  loadData,
  dataVersion: () => ({ dataCommit: 'abc1234', rejectedData: null }),
}))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))
vi.mock('@/application/usecases/GetSyncStatus', () => ({ getLastSyncedAt }))

const { GET } = await import('../route')

const SECRET = 'test-secret'
const NOW = new Date('2026-10-27T12:00:00Z')

function request({ secret = SECRET }: { secret?: string | null } = {}) {
  return new NextRequest('https://example.com/api/internal/health', {
    headers: secret === null ? {} : { 'x-internal-secret': secret },
  })
}

async function health() {
  const res = await GET(request())
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

describe('GET /api/internal/health', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.clearAllMocks()
    loadData.mockResolvedValue(undefined)
    getAllActivities.mockReturnValue([{ date: '2026-10-26T07:30:00Z' }])
    getLastSyncedAt.mockReturnValue('2026-10-27T01:30:00Z')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('answers ok with the hours since the last sync', async () => {
    const { status, body } = await health()

    expect(status).toBe(200)
    expect(body).toMatchObject({
      status: 'ok',
      hoursSinceSync: 11,
      lastSyncedAt: '2026-10-27T01:30:00Z',
      activityCount: 1,
      lastActivityDate: '2026-10-26T07:30:00Z',
      daysSinceLastActivity: 1,
      dataCommit: 'abc1234',
    })
  })

  it('stays ok through a training break while the sync keeps landing', async () => {
    getAllActivities.mockReturnValue([{ date: '2026-07-01T07:30:00Z' }])

    const { status, body } = await health()

    expect(status).toBe(200)
    expect(body).toMatchObject({ status: 'ok', daysSinceLastActivity: 118 })
  })

  it('answers 503 stale once the last sync is 72 hours old', async () => {
    getLastSyncedAt.mockReturnValue('2026-10-24T12:00:00Z')

    const { status, body } = await health()

    expect(status).toBe(503)
    expect(body).toMatchObject({ status: 'stale', hoursSinceSync: 72 })
  })

  it('stays ok just under 72 hours', async () => {
    getLastSyncedAt.mockReturnValue('2026-10-24T12:01:00Z')

    expect((await health()).status).toBe(200)
  })

  it('answers 503 stale when no sync was ever recorded', async () => {
    getLastSyncedAt.mockReturnValue(null)

    const { status, body } = await health()

    expect(status).toBe(503)
    expect(body).toMatchObject({ status: 'stale', hoursSinceSync: null, lastSyncedAt: null })
  })

  it('answers 503 stale when the sync time cannot be read', async () => {
    getLastSyncedAt.mockReturnValue('yesterday')

    const { status, body } = await health()

    expect(status).toBe(503)
    expect(body).toMatchObject({ status: 'stale', hoursSinceSync: null })
  })

  it('answers 503 unloaded with the data version when the data will not load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    loadData.mockRejectedValue(new Error('contract broken'))

    const { status, body } = await health()

    expect(status).toBe(503)
    expect(body).toEqual({ status: 'unloaded', dataCommit: 'abc1234', rejectedData: null })
  })

  it('names the cron credential among the integrations, by name only', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-value')

    const res = await GET(request())
    const text = await res.text()

    expect(JSON.parse(text).integrations).toMatchObject({ cron: true })
    expect(text).not.toContain('cron-value')
  })

  it('reports a missing cron credential', async () => {
    vi.stubEnv('CRON_SECRET', '')

    expect((await health()).body.integrations).toMatchObject({ cron: false })
  })

  it('refuses a caller without the internal secret', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect((await GET(request({ secret: null }))).status).toBe(401)
    expect(loadData).not.toHaveBeenCalled()
  })
})
