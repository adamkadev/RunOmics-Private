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

async function reasonFor(payload: unknown): Promise<string> {
  respondWith(payload)
  const result = await generateInsight(REQUEST)
  return result.ok ? 'unexpectedly ok' : result.reason
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
      ok: true,
      insight: { headline: 'Fresh legs', body: 'Fatigue is down.' },
    })
  })

  it('skips the reasoning parts a thinking model emits alongside the answer', async () => {
    respondWithParts([{ thought: true }, { text: JSON.stringify({ headline: 'Fresh legs', body: 'Go.' }) }])

    expect(await generateInsight(REQUEST)).toEqual({
      ok: true,
      insight: { headline: 'Fresh legs', body: 'Go.' },
    })
  })

  it('never calls the API without a key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateInsight(REQUEST)).toEqual({ ok: false, reason: 'no api key' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reports which field overflowed the card', async () => {
    expect(await reasonFor({ headline: 'A headline far too long for the slot', body: 'ok' })).toBe(
      'headline 36 > 20 chars'
    )
  })

  it('reports an em-dash the house style forbids', async () => {
    expect(await reasonFor({ headline: 'Fresh — go', body: 'Fatigue is down.' })).toBe('em-dash')
  })

  it('reports an empty field', async () => {
    expect(await reasonFor({ headline: '   ', body: 'Fatigue is down.' })).toBe('headline or body empty')
  })

  it('returns the bullets a surface asked the model to phrase', async () => {
    respondWith({ headline: 'Fresh legs', body: 'Fatigue is down.', bullets: ['Faster', 'Fitter'] })

    expect(await generateInsight({ ...REQUEST, bulletCount: 2 })).toEqual({
      ok: true,
      insight: { headline: 'Fresh legs', body: 'Fatigue is down.', bullets: ['Faster', 'Fitter'] },
    })
  })

  it('drops a response whose bullets do not match the reads one for one', async () => {
    respondWith({ headline: 'Fresh legs', body: 'Fatigue is down.', bullets: ['Faster'] })
    const result = await generateInsight({ ...REQUEST, bulletCount: 2 })

    expect(result).toEqual({ ok: false, reason: '1 bullets, expected 2' })
  })

  it('holds bullets to the house style too', async () => {
    respondWith({ headline: 'Fresh legs', body: 'Fatigue is down.', bullets: ['Faster — much', 'Fitter'] })
    const result = await generateInsight({ ...REQUEST, bulletCount: 2 })

    expect(result).toEqual({ ok: false, reason: 'em-dash' })
  })

  it('never asks for bullets when the surface does not want any', async () => {
    respondWith({ headline: 'Fresh legs', body: 'Fatigue is down.' })
    await generateInsight(REQUEST)

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1] as { body: string }).body)
    expect(body.generationConfig.responseSchema.properties).not.toHaveProperty('bullets')
  })

  it('reports the status and body when the API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'quota' }))

    expect(await generateInsight(REQUEST)).toEqual({ ok: false, reason: 'http 429: quota' })
  })

  it('reports the failure rather than throwing when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const result = await generateInsight(REQUEST)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('offline')
  })
})

describe('generateInsight (French locale)', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('NEXT_PUBLIC_LOCALE', 'fr')
    vi.resetModules()
  })

  const FR_REQUEST = { ...REQUEST, limits: { headline: 60, body: 150 } }

  async function reasonForFr(payload: unknown): Promise<string> {
    respondWith(payload)
    const { generateInsight: generate } = await import('@/lib/gemini')
    const result = await generate(FR_REQUEST)
    return result.ok ? 'unexpectedly ok' : result.reason
  }

  it('rejects a dropped elision apostrophe', async () => {
    expect(
      await reasonForFr({ headline: "L'effort a payé", body: 'La récupération sera longue après cet effort.' })
    ).toBe('unexpectedly ok')

    expect(
      await reasonForFr({ headline: 'Effort réussi', body: 'L effort a bien payé pour cette séance de seuil.' })
    ).toBe('french elision missing')
  })

  it('rejects French text with every accent stripped', async () => {
    expect(
      await reasonForFr({
        headline: 'Seance solide',
        body: "L'intensite a depasse la cible et impose une recuperation prolongee pour la suite.",
      })
    ).toBe('french text missing all accents')
  })

  it('accepts correct French with accents and elisions intact', async () => {
    expect(
      await reasonForFr({
        headline: 'Séance solide et maîtrisée',
        body: "L'intensité a dépassé la cible et impose une récupération prolongée pour la suite.",
      })
    ).toBe('unexpectedly ok')
  })
})
