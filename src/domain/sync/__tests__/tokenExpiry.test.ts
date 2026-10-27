import { describe, expect, it } from 'vitest'
import { expiringSoon, parseBareDate, parseGitHubExpiry } from '../tokenExpiry'

describe('token expiry', () => {
  it('reads GitHub’s expiry header, offset or UTC, and nothing for a token that never expires', () => {
    expect(parseGitHubExpiry('2026-11-26 00:00:00 +0100')?.toISOString()).toBe('2026-11-25T23:00:00.000Z')
    expect(parseGitHubExpiry('2026-11-26 00:00:00 UTC')?.toISOString()).toBe('2026-11-26T00:00:00.000Z')
    expect(parseGitHubExpiry(null)).toBeNull()
  })

  it('reads a bare date as midnight UTC, and refuses a day the calendar does not have', () => {
    expect(parseBareDate('2027-10-01')?.toISOString()).toBe('2027-10-01T00:00:00.000Z')
    expect(parseBareDate(' 2027-10-01 ')?.toISOString()).toBe('2027-10-01T00:00:00.000Z')
    expect(parseBareDate('2027-02-30')).toBeNull()
    expect(parseBareDate('01/10/2027')).toBeNull()
    expect(parseBareDate('')).toBeNull()
  })

  it('names the tokens that expire within two weeks, soonest first', () => {
    const now = new Date('2026-11-14T12:00:00Z')
    const soon = expiringSoon(
      [
        { name: 'data (Vercel)', expiresAt: new Date('2026-11-26T00:00:00Z') },
        { name: 'sync button', expiresAt: new Date('2027-03-01T00:00:00Z') },
        { name: 'data (Actions)', expiresAt: new Date('2026-11-20T00:00:00Z') },
      ],
      now,
    )
    expect(soon.map((t) => [t.name, t.daysLeft])).toEqual([['data (Actions)', 5], ['data (Vercel)', 11]])
  })
})
