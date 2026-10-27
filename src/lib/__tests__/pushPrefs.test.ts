import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  forgetRegistration,
  isRegistrationDue,
  registrationFailed,
  rememberRegistration,
  savedRegistration,
  setRegistrationFailed,
  subscribeRegistration,
  TOKEN_REFRESH_MS,
} from '../pushPrefs'

const NOW = Date.parse('2026-10-27T08:00:00Z')

describe('isRegistrationDue', () => {
  it('saves a device the app never remembered, a rotated token and a month-old save', () => {
    expect(isRegistrationDue(null, 'token-a', NOW)).toBe(true)
    expect(isRegistrationDue({ token: 'token-a', savedAt: NOW - 1000 }, 'token-b', NOW)).toBe(true)
    expect(isRegistrationDue({ token: 'token-a', savedAt: NOW - TOKEN_REFRESH_MS - 1 }, 'token-a', NOW)).toBe(true)
  })

  it('leaves a recent save of the same token alone', () => {
    expect(isRegistrationDue({ token: 'token-a', savedAt: NOW - 1000 }, 'token-a', NOW)).toBe(false)
  })
})

describe('the remembered registration', () => {
  afterEach(() => localStorage.clear())

  it('clears a failed registration once a save succeeds, and tells Settings', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeRegistration(listener)
    setRegistrationFailed(true)
    expect(registrationFailed()).toBe(true)

    rememberRegistration('token-a', NOW)
    expect(registrationFailed()).toBe(false)
    expect(savedRegistration()).toEqual({ token: 'token-a', savedAt: NOW })
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('forgets the token when pushes are turned off', () => {
    rememberRegistration('token-a', NOW)
    forgetRegistration()
    expect(savedRegistration()).toBeNull()
  })
})
