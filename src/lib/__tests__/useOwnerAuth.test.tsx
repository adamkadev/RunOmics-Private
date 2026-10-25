import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOwnerAuth } from '@/lib/useOwnerAuth'

interface MockUser {
  email: string
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{ claims: Record<string, unknown> }>
}

let mockUser: MockUser | null = null
let listeners: ((user: MockUser | null) => void)[] = []
const forceRefreshCalls: (boolean | undefined)[] = []

function signedIn(email: string, claims: Record<string, unknown>): MockUser {
  return {
    email,
    getIdTokenResult: (forceRefresh?: boolean) => {
      forceRefreshCalls.push(forceRefresh)
      return Promise.resolve({ claims })
    },
  }
}

vi.mock('@/lib/firebaseConfig', () => ({ isClientFirebaseConfigured: true }))

vi.mock('@/lib/firebaseAuth', () => ({
  isClientFirebaseConfigured: true,
  getClientAuth: () => ({}),
}))

vi.mock('firebase/auth', () => ({
  onIdTokenChanged: (_auth: unknown, cb: (user: MockUser | null) => void) => {
    listeners.push(cb)
    cb(mockUser)
    return () => {
      listeners = listeners.filter((l) => l !== cb)
    }
  },
}))

describe('useOwnerAuth', () => {
  beforeEach(() => {
    mockUser = null
    listeners = []
    forceRefreshCalls.length = 0
  })

  it('reports a signed-out visitor as a non-owner once resolved', async () => {
    const { result } = renderHook(() => useOwnerAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.isOwner).toBe(false)
  })

  it('denies a signed-in account without the owner claim', async () => {
    mockUser = signedIn('someone-else@example.com', {})
    const { result } = renderHook(() => useOwnerAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBe(mockUser)
    expect(result.current.isOwner).toBe(false)
  })

  it('grants access on the owner claim', async () => {
    mockUser = signedIn('owner@example.com', { owner: true })
    const { result } = renderHook(() => useOwnerAuth())

    await waitFor(() => expect(result.current.isOwner).toBe(true))
  })

  it('denies the configured owner email when the claim is absent', async () => {
    process.env.NEXT_PUBLIC_OWNER_EMAIL = 'owner@example.com'
    mockUser = signedIn('owner@example.com', {})
    const { result } = renderHook(() => useOwnerAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOwner).toBe(false)
  })

  it('grants access on the claim whatever the email is', async () => {
    process.env.NEXT_PUBLIC_OWNER_EMAIL = 'owner@example.com'
    mockUser = signedIn('a-completely-different@example.com', { owner: true })
    const { result } = renderHook(() => useOwnerAuth())

    await waitFor(() => expect(result.current.isOwner).toBe(true))
  })

  it('rejects a non-boolean owner claim', async () => {
    mockUser = signedIn('owner@example.com', { owner: 'true' })
    const { result } = renderHook(() => useOwnerAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOwner).toBe(false)
  })

  it('reads the cached token instead of forcing a refresh', async () => {
    mockUser = signedIn('owner@example.com', { owner: true })
    const { result } = renderHook(() => useOwnerAuth())

    await waitFor(() => expect(result.current.isOwner).toBe(true))
    expect(forceRefreshCalls).toEqual([undefined])
  })

  it('follows sign-out and a later token change', async () => {
    mockUser = signedIn('owner@example.com', { owner: true })
    const { result } = renderHook(() => useOwnerAuth())
    await waitFor(() => expect(result.current.isOwner).toBe(true))

    for (const notify of listeners) notify(null)
    await waitFor(() => expect(result.current.isOwner).toBe(false))
    expect(result.current.user).toBeNull()

    const next = signedIn('owner@example.com', { owner: true })
    for (const notify of listeners) notify(next)
    await waitFor(() => expect(result.current.isOwner).toBe(true))
  })

  it('shares one listener and one token read across every owner-only part of the page', async () => {
    mockUser = signedIn('owner@example.com', { owner: true })
    const { result } = renderHook(() => [useOwnerAuth(), useOwnerAuth(), useOwnerAuth()])

    await waitFor(() => expect(result.current.every((auth) => auth.isOwner)).toBe(true))
    expect(listeners).toHaveLength(1)
    expect(forceRefreshCalls).toHaveLength(1)
  })

  it('denies access when the token cannot be read', async () => {
    mockUser = {
      email: 'owner@example.com',
      getIdTokenResult: () => Promise.reject(new Error('network')),
    }
    const { result } = renderHook(() => useOwnerAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isOwner).toBe(false)
  })
})
