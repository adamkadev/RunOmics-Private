import { afterEach, describe, expect, it, vi } from 'vitest'

const { getToken } = vi.hoisted(() => ({ getToken: vi.fn() }))

vi.mock('firebase/messaging', () => ({
  isSupported: vi.fn().mockResolvedValue(true),
  getMessaging: vi.fn(() => ({})),
  getToken,
  deleteToken: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}))
vi.mock('@/lib/firebase', () => ({ getClientApp: vi.fn(), getClientFirestore: vi.fn() }))

import { enablePushNotifications } from '@/lib/pushNotifications'

describe('enablePushNotifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'serviceWorker')
    localStorage.clear()
  })

  it('takes the token on the worker already running, never registering one of its own', async () => {
    const ready = { scope: '/' }
    const register = vi.fn()
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(ready), register } })
    vi.stubGlobal('Notification', { permission: 'granted' })
    getToken.mockResolvedValue('token-a')

    await expect(enablePushNotifications({ training: true, shoes: false, records: false })).resolves.toBe('token-a')

    expect(register).not.toHaveBeenCalled()
    expect(getToken).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ serviceWorkerRegistration: ready }))
  })
})
