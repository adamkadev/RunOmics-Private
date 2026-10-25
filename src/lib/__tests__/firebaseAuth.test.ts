import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ initializeAuth: vi.fn<(app: unknown, deps: Record<string, unknown>) => object>(() => ({})) }))

vi.mock('@/lib/firebaseApp', () => ({ getClientApp: () => ({}) }))
vi.mock('firebase/auth', () => ({
  initializeAuth: sdk.initializeAuth,
  getAuth: () => ({}),
  connectAuthEmulator: () => {},
  browserLocalPersistence: 'local',
  indexedDBLocalPersistence: 'indexedDB',
  browserPopupRedirectResolver: 'popup-resolver',
}))

describe('the client Auth', () => {
  beforeEach(() => {
    vi.resetModules()
    sdk.initializeAuth.mockClear()
  })

  it('starts without the popup resolver, so iOS loads no Google iframe before reading the account', async () => {
    const { getClientAuth } = await import('@/lib/firebaseAuth')
    getClientAuth()
    getClientAuth({ forSignIn: true })
    expect(sdk.initializeAuth).toHaveBeenCalledTimes(1)
    expect(sdk.initializeAuth.mock.calls[0]![1]).toEqual({ persistence: ['indexedDB', 'local'] })
  })

  it('has the resolver ready on the sign-in page, before the tap that opens the popup', async () => {
    const { getClientAuth } = await import('@/lib/firebaseAuth')
    getClientAuth({ forSignIn: true })
    expect(sdk.initializeAuth.mock.calls[0]![1]).toMatchObject({ popupRedirectResolver: 'popup-resolver' })
  })
})
