import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { runInsightPass, recordAiPass, sendPush } = vi.hoisted(() => ({
  runInsightPass: vi.fn(),
  recordAiPass: vi.fn(),
  sendPush: vi.fn(),
}))
vi.mock('@/application/ai/insightPass', () => ({ runInsightPass }))
vi.mock('@/application/ai/surfaces', () => ({ insightSurfaces: () => ({}) }))
vi.mock('@/application/usecases/AiPassStatus', () => ({ recordAiPass }))
vi.mock('@/application/usecases/LoadData', () => ({ loadData: vi.fn(async () => {}) }))
vi.mock('@/infrastructure/repositories/FirestoreInsightsRepository', () => ({
  getCachedInsight: vi.fn(),
  saveCachedInsight: vi.fn(),
  listCachedKeys: vi.fn(),
  readVerdictPhrasing: vi.fn(),
  saveVerdictPhrasing: vi.fn(),
}))
vi.mock('@/infrastructure/repositories/FirestoreJobEventRepository', () => ({ keepJobEvent: vi.fn() }))
vi.mock('@/application/ai/aiSpend', () => ({ openSpender: vi.fn(async () => ({})) }))
vi.mock('@/lib/sendPushNotification', () => ({ sendPush }))

const { POST } = await import('../route')

const SECRET = 'test-secret'
const REPORT = { missed: 2, closedModels: [{ model: 'gemini-3.8-flash', reason: 'http 404: gone' }] }

function pass(query = '') {
  return POST(new NextRequest(`https://example.com/api/internal/ai-insights${query}`, { method: 'POST', headers: { 'x-internal-secret': SECRET } }))
}

function status(alert: boolean) {
  return { status: { closedModels: REPORT.closedModels }, alert }
}

describe('POST /api/internal/ai-insights, the pass status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', SECRET)
    vi.stubEnv('GEMINI_API_KEY', 'key')
    vi.stubEnv('FIREBASE_PROJECT_ID', 'demo')
    vi.stubEnv('FIREBASE_CLIENT_EMAIL', 'firebase-admin')
    vi.stubEnv('FIREBASE_PRIVATE_KEY', 'key')
    vi.stubEnv('OPS_PUSH_URL', '')
    runInsightPass.mockResolvedValue(REPORT)
    recordAiPass.mockResolvedValue(status(false))
    sendPush.mockResolvedValue({ sent: 1, failed: 0 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('keeps each pass’s status and pushes nothing while the nights are not idle enough', async () => {
    const res = await pass()

    expect(await res.json()).toEqual(REPORT)
    expect(recordAiPass).toHaveBeenCalledWith(REPORT)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('pushes the operator once the status asks for it, naming the closed models', async () => {
    recordAiPass.mockResolvedValue(status(true))

    await pass()

    expect(sendPush).toHaveBeenCalledWith('always', {
      title: 'No AI copy written for 3 nights',
      body: expect.stringContaining('gemini-3.8-flash'),
      link: '/settings',
      tag: 'ai-idle',
    })
  })

  it('keeps no status for a pass that only counts the backlog', async () => {
    await pass('?limit=0')

    expect(recordAiPass).not.toHaveBeenCalled()
  })

  it('still answers the report when the status cannot be kept', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    recordAiPass.mockRejectedValue(new Error('Firestore is down'))

    const res = await pass()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(REPORT)
  })
})
