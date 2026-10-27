import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { registrationFailed } from '@/lib/pushPrefs'

const { refreshPushRegistration, auth } = vi.hoisted(() => ({
  refreshPushRegistration: vi.fn(),
  auth: { current: { user: null, isOwner: true, loading: false } },
}))

vi.mock('@/lib/pushNotifications', () => ({ refreshPushRegistration }))
vi.mock('@/lib/useOwnerAuth', () => ({ useOwnerAuth: () => auth.current }))

async function loadRefresh() {
  vi.resetModules()
  return (await import('@/components/layout/PushTokenRefresh')).PushTokenRefresh
}

function grantPush() {
  vi.stubGlobal('Notification', { permission: 'granted' })
  vi.stubGlobal('PushManager', class {})
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
}

describe('PushTokenRefresh', () => {
  beforeEach(() => {
    refreshPushRegistration.mockReset().mockResolvedValue(undefined)
    auth.current = { user: null, isOwner: true, loading: false }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'serviceWorker')
    localStorage.clear()
  })

  it('re-saves the owner’s device with the switches stored on it', async () => {
    grantPush()
    localStorage.setItem('notif_training', 'true')
    const PushTokenRefresh = await loadRefresh()

    render(<PushTokenRefresh />)

    await vi.waitFor(() => expect(refreshPushRegistration).toHaveBeenCalledWith({ training: true, shoes: false, records: false }))
  })

  it('leaves a device that never turned pushes on, or a visitor, alone', async () => {
    grantPush()
    const NeverTurnedOn = await loadRefresh()
    render(<NeverTurnedOn />)
    localStorage.setItem('notif_training', 'true')
    auth.current = { user: null, isOwner: false, loading: false }
    const Visitor = await loadRefresh()
    render(<Visitor />)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(refreshPushRegistration).not.toHaveBeenCalled()
  })

  it('marks the device unregistered when the refresh fails', async () => {
    grantPush()
    localStorage.setItem('notif_training', 'true')
    refreshPushRegistration.mockRejectedValue(new Error('messaging/token-subscribe-failed'))
    const PushTokenRefresh = await loadRefresh()

    render(<PushTokenRefresh />)

    await vi.waitFor(() => expect(registrationFailed()).toBe(true))
  })
})
