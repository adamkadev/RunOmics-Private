import { expiringSoon, parseBareDate, parseGitHubExpiry, type TokenExpiry } from '@/domain/sync/tokenExpiry'
import { githubTokenExpiry } from '@/infrastructure/githubTokenExpiry'

export const TOKEN_KEYS = ['dataActions', 'dataVercel', 'syncVercel', 'garminKey'] as const
export type TokenKey = (typeof TOKEN_KEYS)[number]
export type GitHubTokenKey = Exclude<TokenKey, 'garminKey'>

const SERVER_TOKENS: readonly [string, TokenKey][] = [
  ['RUNOMICS_DATA_REPO_TOKEN', 'dataVercel'],
  ['GITHUB_SYNC_TOKEN', 'syncVercel'],
]

/** `reported` is what the workflow read: a GitHub expiry header per token, or a bare date for `garminKey`. */
export async function checkTokenExpiry(reported: unknown, now = new Date()) {
  const tokens: TokenExpiry[] = []
  for (const entry of Array.isArray(reported) ? reported : []) {
    const { name, expiresAt } = (entry ?? {}) as Record<string, unknown>
    const date = typeof expiresAt === 'string' ? (parseGitHubExpiry(expiresAt) ?? parseBareDate(expiresAt)) : null
    if ((TOKEN_KEYS as readonly unknown[]).includes(name) && date) tokens.push({ name: name as TokenKey, expiresAt: date })
  }
  for (const [env, name] of SERVER_TOKENS) {
    const token = process.env[env]?.trim()
    if (!token) continue
    try {
      const date = await githubTokenExpiry(token)
      if (date) tokens.push({ name, expiresAt: date })
    } catch {
      console.error(`[token-expiry] could not read the expiry of ${env}`)
    }
  }
  return { tokens, expiring: expiringSoon(tokens, now) }
}
