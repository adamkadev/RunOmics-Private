import 'server-only'
import { parseGitHubExpiry } from '@/domain/sync/tokenExpiry'

/** `rate_limit` costs nothing against the quota, and every answer carries the token's expiry. */
export async function githubTokenExpiry(token: string): Promise<Date | null> {
  const res = await fetch('https://api.github.com/rate_limit', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  return parseGitHubExpiry(res.headers.get('github-authentication-token-expiration'))
}
