import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CoachWords } from '@/application/coaching/GetCoachWords'
import { COACH_WORDS_PATH, forgetCoachWords, readCoachWords } from '../useCoachWords'

const WORDS: CoachWords = {
  block: { name: 'Reprise en douceur', focus: 'Trois sorties par semaine.' },
  weeks: [
    { startDate: '2026-09-07', endDate: '2026-09-13', focus: 'On démarre doucement.' },
    { startDate: '2026-09-14', endDate: '2026-09-20', focus: '' },
  ],
  sessions: {
    'run-walk': { description: 'Course très lente, 1 minute de marche.', notes: ['Passe à la marche au moindre doute.'] },
    'easy-run': { description: 'Easy run', notes: [] },
  },
}

describe('the coach’s words', () => {
  afterEach(() => {
    forgetCoachWords()
    vi.unstubAllGlobals()
  })

  it('asks the server once for every reader, and reads a refusal as none', async () => {
    const fetch = vi.fn(async () => Response.json({ available: true, ...WORDS }))
    vi.stubGlobal('fetch', fetch)
    const [first, second] = await Promise.all([readCoachWords(), readCoachWords()])
    expect(first).toEqual(WORDS)
    expect(second).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(COACH_WORDS_PATH)

    forgetCoachWords()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Sign in required', { status: 401 })))
    expect(await readCoachWords()).toBeNull()

    forgetCoachWords()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ available: false })))
    expect(await readCoachWords()).toBeNull()
  })
})
