import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { lastJobRuns, lastAiPass, requireOwner } = vi.hoisted(() => ({
  lastJobRuns: vi.fn(),
  lastAiPass: vi.fn(),
  requireOwner: vi.fn(),
}))
vi.mock('@/application/usecases/JobEvents', () => ({ lastJobRuns }))
vi.mock('@/application/usecases/AiPassStatus', () => ({ lastAiPass }))
vi.mock('@/lib/ownerRoute', () => ({ requireOwner }))

const { GET } = await import('../route')

const get = () => GET(new NextRequest('https://example.com/api/job-events'))

describe('GET /api/job-events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireOwner.mockResolvedValue(null)
  })

  it('answers the owner each job’s last run and the last AI pass, never cached', async () => {
    const job = { at: '2026-10-27T01:00:02Z', route: 'nightly-sync', trigger: 'cron', outcome: 'sent', status: 200 }
    const pass = { at: '2026-10-27T01:40:00Z', generated: 2, missed: 0, closedModels: [], idleDays: [], alerted: false }
    lastJobRuns.mockResolvedValue([job])
    lastAiPass.mockResolvedValue(pass)

    const res = await get()

    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(await res.json()).toEqual({ jobs: [job], ai: pass })
  })

  it('reads nothing for anyone else', async () => {
    requireOwner.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    expect((await get()).status).toBe(401)
    expect(lastJobRuns).not.toHaveBeenCalled()
    expect(lastAiPass).not.toHaveBeenCalled()
  })
})
