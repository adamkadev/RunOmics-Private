import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateInsight } from '@/lib/gemini'

const REQUEST = {
  model: 'test-model',
  systemInstruction: 'sys',
  prompt: 'prompt',
  limits: { headline: 20, body: 40 },
}

function respondWithParts(parts: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts } }] }),
    })
  )
}

function respondWith(payload: unknown) {
  respondWithParts([{ text: JSON.stringify(payload) }])
}

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('generateInsight', () => {
  it('returns the parsed insight when the response fits the limits', async () => {
    respondWith({ headline: 'Fresh legs', body: 'Fatigue is down.' })

    expect(await generateInsight(REQUEST)).toEqual({
      headline: 'Fresh legs',
      body: 'Fatigue is down.',
    })
  })

  it('skips the reasoning parts a thinking model emits alongside the answer', async () => {
    respondWithParts([{ thought: true }, { text: JSON.stringify({ headline: 'Fresh legs', body: 'Go.' }) }])

    expect(await generateInsight(REQUEST)).toEqual({ headline: 'Fresh legs', body: 'Go.' })
  })

  it('never calls the API without a key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateInsight(REQUEST)).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects copy that overflows the card', async () => {
    respondWith({ headline: 'A headline far too long for the slot', body: 'ok' })
    expect(await generateInsight(REQUEST)).toBeNull()
  })

  it('rejects an em-dash the house style forbids', async () => {
    respondWith({ headline: 'Fresh — go', body: 'Fatigue is down.' })
    expect(await generateInsight(REQUEST)).toBeNull()
  })

  it('rejects an empty field', async () => {
    respondWith({ headline: '   ', body: 'Fatigue is down.' })
    expect(await generateInsight(REQUEST)).toBeNull()
  })

  it('returns null rather than throwing when the API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'quota' }))
    expect(await generateInsight(REQUEST)).toBeNull()
  })

  it('returns null rather than throwing when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await generateInsight(REQUEST)).toBeNull()
  })
})
