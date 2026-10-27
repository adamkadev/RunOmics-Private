/** Two weeks: time to renew a token on a weekend before the sync stops. */
export const TOKEN_WARN_DAYS = 14

const DAY_MS = 86_400_000

export interface TokenExpiry {
  /** Which token, by its role: never its value. */
  name: string
  expiresAt: Date
}

/** GitHub's `github-authentication-token-expiration` reads "2026-11-26 00:00:00 +0100" or "… UTC"; none means it never expires. */
export function parseGitHubExpiry(header: string | null | undefined): Date | null {
  const m = header?.trim().match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) (UTC|[+-]\d{4})$/)
  if (!m) return null
  const zone = m[3] === 'UTC' ? 'Z' : `${m[3]!.slice(0, 3)}:${m[3]!.slice(3)}`
  const date = new Date(`${m[1]}T${m[2]}${zone}`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** A bare `YYYY-MM-DD`, as typed into a GitHub Environment variable: midnight UTC that day. */
export function parseBareDate(value: string | null | undefined): Date | null {
  const m = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return date.toISOString().startsWith(value!.trim()) ? date : null
}

export function expiringSoon(tokens: readonly TokenExpiry[], now: Date, withinDays = TOKEN_WARN_DAYS): (TokenExpiry & { daysLeft: number })[] {
  return tokens
    .map((token) => ({ ...token, daysLeft: Math.floor((token.expiresAt.getTime() - now.getTime()) / DAY_MS) }))
    .filter((token) => token.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}
