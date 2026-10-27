import { afterAll, describe, expect, it, vi } from 'vitest'
import { GET } from '../route'
import { activeLocale, t } from '@/i18n'

describe('GET /manifest.json', () => {
  it('names the app, its language and its scope, with the description in that language', async () => {
    const response = GET()
    const manifest = await response.json()

    expect(response.headers.get('content-type')).toBe('application/manifest+json')
    expect(manifest).toMatchObject({ name: 'RunOmics', id: '/', scope: '/', start_url: '/', lang: activeLocale, description: t.meta.description })
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  describe('in the French build', () => {
    afterAll(() => {
      vi.unstubAllEnvs()
      vi.resetModules()
    })

    it('says it is French and describes itself in French', async () => {
      vi.stubEnv('NEXT_PUBLIC_LOCALE', 'fr')
      vi.resetModules()
      const fr = await import('../route')
      const { fr: strings } = await import('@/i18n/fr')

      expect(await fr.GET().json()).toMatchObject({ lang: 'fr', description: strings.meta.description })
    })
  })
})
