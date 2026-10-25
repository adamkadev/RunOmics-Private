import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getActivityNotes } = vi.hoisted(() => ({ getActivityNotes: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreActivityNoteRepository', () => ({ getActivityNotes }))

const { GET } = await import('../route')

const request = () => new NextRequest('https://example.com/api/internal/activity-notes', { headers: { 'x-internal-secret': 'test-secret' } })

describe('GET /api/internal/activity-notes', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', 'test-secret')
  })

  it('hands the sync every note, sorted by run, for a stable commit', async () => {
    getActivityNotes.mockResolvedValue({
      available: true,
      notes: new Map([
        ['202', { note: 'Windy', tags: ['wind'] }],
        ['101', { note: '', tags: ['illness'] }],
      ]),
    })

    const res = await GET(request())
    expect(await res.text()).toBe('{"notes":{"101":{"note":"","tags":["illness"]},"202":{"note":"Windy","tags":["wind"]}}}')
  })

  it('answers 503 when Firestore did not, so the sync keeps the last copy', async () => {
    getActivityNotes.mockResolvedValue({ available: false, notes: new Map() })
    expect((await GET(request())).status).toBe(503)
  })
})
