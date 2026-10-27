import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCoachWords = vi.hoisted(() => vi.fn())
vi.mock('@/application/coaching/GetCoachWords', () => ({ getCoachWords }))
vi.mock('@/application/usecases/LoadData', () => ({ loadData: async () => {} }))

import { GET } from '../route'

const WORDS = {
  block: { name: 'Reprise en douceur', focus: 'Trois sorties par semaine.' },
  weeks: [{ startDate: '2026-09-07', endDate: '2026-09-13', focus: 'On démarre doucement.' }],
  sessions: { 'workout-1': { description: 'Course très lente.', notes: [] } },
}

describe('/api/coaching/words', () => {
  beforeEach(() => getCoachWords.mockReset())

  it('answers with the coach’s words, never cached', async () => {
    getCoachWords.mockReturnValue(WORDS)
    const response = await GET()
    expect(await response.json()).toEqual({ available: true, ...WORDS })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('says when there is no plan rather than failing', async () => {
    getCoachWords.mockReturnValue(null)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ available: false })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
