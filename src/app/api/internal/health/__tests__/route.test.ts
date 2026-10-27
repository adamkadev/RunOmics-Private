import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { loadData, getAllActivities, getLastSyncedAt, lastAiPass, liveFirestoreRulesHash } = vi.hoisted(() => ({
  loadData: vi.fn(),
  getAllActivities: vi.fn(),
  getLastSyncedAt: vi.fn(),
  lastAiPass: vi.fn(),
  liveFirestoreRulesHash: vi.fn(),
}))

vi.mock('@/application/usecases/LoadData', () => ({
  loadData,
  dataVersion: () => ({ dataCommit: 'abc1234', rejectedData: null }),
}))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))
const meta = vi.hoisted(() => ({ extra: {} as Record<string, unknown> }))
vi.mock('@/application/usecases/GetSyncStatus', () => ({
  getSyncMeta: () => ({ lastSyncedAt: getLastSyncedAt(), warnings: [], warningsAt: null, seriesNewest: {}, shoesCheckedAt: null, ...meta.extra }),
}))
vi.mock('@/application/usecases/AiPassStatus', () => ({ lastAiPass }))
vi.mock('@/infrastructure/firestoreRulesHash', () => ({ liveFirestoreRulesHash }))

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
    meta.extra = {}
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

  it('names the Garmin series that stopped updating, since when, and the night\'s endpoint warnings', async () => {
    meta.extra = {
      warnings: [{ step: 'training status', message: 'HTTP 500' }, { step: 'training status', message: 'HTTP 502' }],
      warningsAt: '2026-10-27T01:30:00Z',
      seriesNewest: { trainingStatus: '2026-10-19', restingHr: '2026-10-26', vo2max: null },
    }

    const { status, body } = await health()

    expect(status).toBe(200)
    expect(body.connectWarnings).toEqual({ count: 2, steps: ['training status'], at: '2026-10-27T01:30:00Z' })
    expect(body.staleSeries).toEqual([{ series: 'trainingStatus', since: '2026-10-19' }])
    expect(body.seriesFreshness).toContainEqual({ series: 'restingHr', newest: '2026-10-26', ageDays: 1, stale: false })
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

  it('reports the last AI pass and the live rules hash once Firestore is configured', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'demo')
    vi.stubEnv('FIREBASE_CLIENT_EMAIL', 'firebase-admin')
    vi.stubEnv('FIREBASE_PRIVATE_KEY', 'key')
    const pass = { at: '2026-10-27T01:40:00Z', generated: 0, missed: 3, closedModels: [], idleDays: ['2026-10-27'], alerted: false }
    lastAiPass.mockResolvedValue(pass)
    liveFirestoreRulesHash.mockResolvedValue('abc123')

    const { status, body } = await health()

    expect(status).toBe(200)
    expect(body).toMatchObject({ ai: pass, firestoreRulesHash: 'abc123' })
  })

  it('answers null for the rules hash it may not read, and stays ok', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('FIREBASE_PROJECT_ID', 'demo')
    vi.stubEnv('FIREBASE_CLIENT_EMAIL', 'firebase-admin')
    vi.stubEnv('FIREBASE_PRIVATE_KEY', 'key')
    lastAiPass.mockResolvedValue(null)
    liveFirestoreRulesHash.mockRejectedValue(new Error('PERMISSION_DENIED'))

    const { status, body } = await health()

    expect(status).toBe(200)
    expect(body).toMatchObject({ ai: null, firestoreRulesHash: null })
  })

  it('reads neither without Firestore credentials', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '')

    expect((await health()).body).toMatchObject({ ai: null, firestoreRulesHash: null })
    expect(lastAiPass).not.toHaveBeenCalled()
  })

  it('refuses a caller without the internal secret', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect((await GET(request({ secret: null }))).status).toBe(401)
    expect(loadData).not.toHaveBeenCalled()
  })
})
