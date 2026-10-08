import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getActivityNote = vi.hoisted(() => vi.fn())
vi.mock('@/application/usecases/GetActivityNote', () => ({ getActivityNote }))

import { GET } from '../route'

function get(id: string) {
  return GET(new NextRequest(`https://run.example/api/activities/${encodeURIComponent(id)}/note`), { params: Promise.resolve({ id }) })
}

describe('/api/activities/[id]/note', () => {
  beforeEach(() => getActivityNote.mockReset())

  it('answers with the note, never cached', async () => {
    getActivityNote.mockResolvedValue({ available: true, note: { note: 'Felt sick', tags: ['illness'] } })
    const response = await get('101')
    expect(getActivityNote).toHaveBeenCalledWith('101')
    expect(await response.json()).toEqual({ available: true, note: 'Felt sick', tags: ['illness'] })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('answers an empty note for a run nobody annotated', async () => {
    getActivityNote.mockResolvedValue({ available: true, note: null })
    expect(await (await get('102')).json()).toEqual({ available: true, note: '', tags: [] })
  })

  // Not a 503: a deployment without notes is not an error, and the browser
  // would log one on every activity page.
  it('says when notes cannot be read, rather than that there is none', async () => {
    getActivityNote.mockResolvedValue({ available: false })
    const response = await get('103')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ available: false })
  })

  it('never reads a path that is not one document', async () => {
    for (const id of ['', 'a/b', '..', 'x'.repeat(129)]) {
      expect((await get(id)).status, id).toBe(404)
    }
    expect(getActivityNote).not.toHaveBeenCalled()
  })
})
