import 'server-only'
import { SESSION_COOKIE, isSitePrivate, sessionSecret, signSession } from '@/lib/siteAccess'

const MAIN_PAGES = ['/', '/activities', '/plan', '/analytics', '/profile']
/** Long enough for a cold render of every page at once, short enough that a leaked cookie is worth nothing. */
const SESSION_SEC = 120
const TIMEOUT_MS = 60_000
// The tag's expiry is sent in the background as the response closes: a page warmed before it lands is the old one.
const SETTLE_MS = 2_000

type Fetch = (url: string, init: RequestInit) => Promise<Response>

/** Renders the pages a phone opens first, so the first visit after a sync is served rather than waited on. */
export async function warmPages(
  origin: string,
  newestRunId: () => Promise<string | null>,
  { env = process.env, fetchPage = fetch, settleMs = SETTLE_MS }: { env?: Record<string, string | undefined>; fetchPage?: Fetch; settleMs?: number } = {}
): Promise<void> {
  const started = Date.now()
  try {
    await new Promise((resolve) => setTimeout(resolve, settleMs))
    const secret = sessionSecret(env)
    if (isSitePrivate(env) && !secret) {
      console.warn('[data-revalidate] no warm-up: the private site has no SESSION_SECRET to sign one with')
      return
    }
    const cookie = isSitePrivate(env) && secret
      ? `${SESSION_COOKIE}=${signSession({ sub: 'data-revalidate', owner: true, email: null }, secret, Date.now(), SESSION_SEC)}`
      : undefined

    const newest = await newestRunId()
    const paths = newest ? [...MAIN_PAGES, `/activities/${encodeURIComponent(newest)}`] : MAIN_PAGES
    const signal = AbortSignal.timeout(TIMEOUT_MS)
    const results = await Promise.allSettled(
      paths.map(async (path) => {
        const res = await fetchPage(new URL(path, origin).toString(), {
          headers: cookie ? { cookie } : {},
          cache: 'no-store',
          redirect: 'manual',
          signal,
        })
        // Read to the end: the page is cached once its render completes.
        await res.arrayBuffer()
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      })
    )
    const failed = results.flatMap((result, i) =>
      result.status === 'rejected' ? [`${i < MAIN_PAGES.length ? paths[i] : '/activities/[id]'} ${(result.reason as Error)?.message ?? 'failed'}`] : []
    )
    console.log(`[data-revalidate] warmed ${paths.length - failed.length}/${paths.length} pages in ${Date.now() - started} ms${failed.length ? `; ${failed.join(', ')}` : ''}`)
  } catch (error) {
    console.error('[data-revalidate] warm-up failed:', (error as Error)?.name ?? 'Error')
  }
}
