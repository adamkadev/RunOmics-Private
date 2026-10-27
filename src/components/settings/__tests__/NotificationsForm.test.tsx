import { afterEach, describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationsForm } from '@/components/settings/NotificationsForm'
import { t } from '@/i18n'
import { rememberRegistration, setRegistrationFailed } from '@/lib/pushPrefs'

const { savePushCategories } = vi.hoisted(() => ({ savePushCategories: vi.fn() }))

vi.mock('@/lib/pushNotifications', () => ({
  enablePushNotifications: vi.fn(),
  disablePushNotifications: vi.fn(),
  savePushCategories,
}))

describe('NotificationsForm (v4.17; 3.0 1i)', () => {
  it('draws each alert as a row with the shared switch, named for the alert', async () => {
    render(<NotificationsForm />)
    const n = t.settings.notifications.types
    for (const type of [n.training, n.shoes, n.records]) {
      const toggle = await screen.findByRole('switch', { name: type.title })
      expect(toggle.getAttribute('aria-checked')).toBe('false')
      // Off is the band grey, never drawn as disabled.
      expect(toggle.className).toContain('bg-[var(--band)]')
      expect(screen.getByText(type.title)).toBeInTheDocument()
    }
    await vi.waitFor(() => expect(screen.getAllByRole('switch').every((s) => !(s as HTMLButtonElement).disabled)).toBe(true))
  })

  it('shows the daily reminder time on the training row only', async () => {
    render(<NotificationsForm />)
    const time = await screen.findByTestId('reminder-time')
    expect(time.textContent).toMatch(/^\d{2}:00$/)
    expect(screen.getAllByTestId('reminder-time')).toHaveLength(1)
    expect(time.parentElement!.parentElement!.textContent).toContain(t.settings.notifications.types.training.title)
  })

  describe('on a device already receiving pushes', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      Reflect.deleteProperty(navigator, 'serviceWorker')
      localStorage.clear()
    })

    it('stores the switches on the device token, where the server reads them', async () => {
      vi.stubGlobal('Notification', { permission: 'granted' })
      vi.stubGlobal('PushManager', class {})
      Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
      localStorage.setItem('notif_training', 'true')
      savePushCategories.mockResolvedValue(undefined)

      render(<NotificationsForm />)
      await userEvent.click(await screen.findByRole('switch', { name: t.settings.notifications.types.shoes.title }))

      expect(savePushCategories).toHaveBeenCalledWith({ training: true, shoes: true, records: false })
      expect(localStorage.getItem('notif_shoes')).toBe('true')
    })

    it('keeps every other switch as it is while a tap saves', async () => {
      vi.stubGlobal('Notification', { permission: 'granted' })
      vi.stubGlobal('PushManager', class {})
      Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
      localStorage.setItem('notif_training', 'true')
      localStorage.setItem('notif_races', 'true')
      let finishSave = () => {}
      savePushCategories.mockReturnValue(new Promise<void>((resolve) => { finishSave = resolve }))
      const n = t.settings.notifications.types
      const checked = () => [n.training, n.shoes, n.records].map((type) => screen.getByRole('switch', { name: type.title }).getAttribute('aria-checked'))

      render(<NotificationsForm />)
      await userEvent.click(await screen.findByRole('switch', { name: n.shoes.title }))

      expect(checked()).toEqual(['true', 'true', 'true'])
      await act(async () => finishSave())
      expect(checked()).toEqual(['true', 'true', 'true'])
    })

    it('says the device is not registered when the start-up refresh failed, until a save succeeds', async () => {
      vi.stubGlobal('Notification', { permission: 'granted' })
      vi.stubGlobal('PushManager', class {})
      Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
      localStorage.setItem('notif_training', 'true')

      render(<NotificationsForm />)
      expect(screen.queryByTestId('push-unregistered')).toBeNull()

      act(() => setRegistrationFailed(true))
      expect((await screen.findByTestId('push-unregistered')).textContent).toBe(t.settings.notifications.notRegistered)

      act(() => rememberRegistration('token-a', Date.now()))
      expect(screen.queryByTestId('push-unregistered')).toBeNull()
    })
  })
})
