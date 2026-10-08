/**
 * The browser's half of the private site (RUNOMICS_PRIVATE, src/lib/siteAccess.ts):
 * turning a Google sign-in into the session cookie the proxy reads, and
 * ending it. Safe to import anywhere - no secret and no Node module here.
 */

/** Where the proxy sends a visitor without a session: the one page anyone can open. */
export const SIGN_IN_PATH = '/sign-in'

/** Where /sign-in trades a Firebase ID token for the session cookie. */
export const SESSION_PATH = '/api/session'

/** Pages this app's worker caches (public/sw.js): signed out, they leave the device. */
const PAGE_CACHE_PREFIX = 'runomics-pages-'

/**
 * The page to return to after signing in, from the proxy's `next`: a path on
 * this site and nowhere else. "//evil.example" and "/\evil.example" are
 * other sites to a browser, so the check is the URL parser's, not a prefix.
 */
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

/** A full load of another page of this site, in place of the current one in history. */
export function replacePage(path: string): void {
  window.location.replace(path)
}

export type SessionAnswer = 'open' | 'notInvited' | 'unavailable' | 'failed'

/** Asks the server for the session cookie: 403 is an account nobody invited, 503 a deployment not set up for it. */
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

/**
 * Ends the session on sign-out, and says whether the site is private: then
 * the pages this device cached go with it, and the caller sends the reader to
 * /sign-in. A request that fails leaves the cookie to expire on its own.
 */
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
