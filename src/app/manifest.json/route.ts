import { activeLocale, t } from '@/i18n'
import base from './manifest.base.json'

// Kept at /manifest.json rather than Next's manifest.webmanifest: the proxy skips this path and the worker precaches it.
export const dynamic = 'force-static'

export function GET(): Response {
  const manifest = { ...base, lang: activeLocale, description: t.meta.description }
  return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/manifest+json' } })
}
