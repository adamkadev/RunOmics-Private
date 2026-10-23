// Safe to import anywhere: no secret and no Node module here.

export const SIGN_IN_PATH = '/sign-in'

export const SESSION_PATH = '/api/session'

/** The page caches public/sw.js names: signed out, they leave the device. */
const PAGE_CACHE_PREFIX = 'runomics-pages-'

/** "//evil.example" and "/\evil.example" are other sites to a browser, so the URL parser checks, not a prefix. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/')) return '/'
  const base = 'https://runomics.invalid'
  let url: URL
  try {
    url = new URL(next, base)
  } catch {
    return '/'
  }
  if (url.origin !== base || url.pathname === SIGN_IN_PATH) return '/'
  return `${url.pathname}${url.search}${url.hash}`
}

export function replacePage(path: string): void {
  window.location.replace(path)
}

export type SessionAnswer = 'open' | 'notInvited' | 'unavailable' | 'failed'

export async function openSiteSession(idToken: string): Promise<SessionAnswer> {
  try {
    const response = await fetch(SESSION_PATH, { method: 'POST', headers: { authorization: `Bearer ${idToken}` } })
    if (response.ok) return 'open'
    if (response.status === 403) return 'notInvited'
    if (response.status === 503) return 'unavailable'
    return 'failed'
  } catch {
    return 'failed'
  }
}

/** A request that fails leaves the cookie to expire on its own. */
export async function endSiteSession(): Promise<{ private: boolean }> {
  let isPrivate = false
  try {
    const response = await fetch(SESSION_PATH, { method: 'DELETE' })
    isPrivate = response.ok && ((await response.json()) as { private?: boolean }).private === true
  } catch {
    return { private: false }
  }
  if (isPrivate && typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key.startsWith(PAGE_CACHE_PREFIX)).map((key) => caches.delete(key)))
    } catch {
      // A cache that cannot be read now is cleared by the next worker update.
    }
  }
  return { private: isPrivate }
}
