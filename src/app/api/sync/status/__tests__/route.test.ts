import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const verdictStatus = vi.hoisted(() => vi.fn())
vi.mock('@/lib/verdictStatus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/verdictStatus')>()),
  verdictStatus,
}))
vi.mock('@/lib/ownerRoute', () => ({
  handleOwnerRoute: (_name: string, _req: NextRequest, handler: () => Promise<Response>) => handler(),
}))

import { GET } from '../route'

const SINCE = '2026-10-07T10:00:00.000Z'

function get(etag?: string) {
  return GET(new NextRequest(`https://run.example/api/sync/status?since=${encodeURIComponent(SINCE)}`, { headers: etag ? { 'if-none-match': etag } : {} }))
}

describe('/api/sync/status', () => {
  beforeEach(() => {
    verdictStatus.mockReset()
    verdictStatus.mockResolvedValue({ ready: false, synced: false, reason: 'waiting for the deployment carrying this sync', activity: null, verdict: null })
  })

  it('tags its answer, and answers the same one again with an empty 304', async () => {
    const first = await get()
    expect(first.status).toBe(200)
    const etag = first.headers.get('etag')!
    expect(etag).toMatch(/^".+"$/)

    const again = await get(etag)
    expect(again.status).toBe(304)
    expect(await again.text()).toBe('')
  })

  it('answers in full once the answer changes', async () => {
    const etag = (await get()).headers.get('etag')!
    verdictStatus.mockResolvedValue({ ready: false, synced: true, reason: 'no verdict for this run yet', activity: null, verdict: null })
    const changed = await get(etag)
    expect(changed.status).toBe(200)
    expect((await changed.json()).synced).toBe(true)
  })
})
