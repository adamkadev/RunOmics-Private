import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationsForm } from '@/components/settings/NotificationsForm'
import { t } from '@/i18n'

vi.mock('@/lib/pushNotifications', () => ({
  isPushSupported: () => Promise.resolve(false),
  enablePushNotifications: vi.fn(),
  disablePushNotifications: vi.fn(),
}))

describe('NotificationsForm (v4.17; 3.0 1i)', () => {
  it('draws each alert as a row with the shared switch, named for the alert', async () => {
    render(<NotificationsForm />)
    const n = t.settings.notifications.types
    for (const type of [n.training, n.shoes, n.races]) {
      const toggle = await screen.findByRole('switch', { name: type.title })
      expect(toggle.getAttribute('aria-checked')).toBe('false')
      // Off is the band grey, a choice - never drawn as disabled.
      expect(toggle.className).toContain('bg-[var(--band)]')
      expect(screen.getByText(type.title)).toBeInTheDocument()
    }
    await vi.waitFor(() => expect(screen.getAllByRole('switch').every((s) => !(s as HTMLButtonElement).disabled)).toBe(true))
  })

  // The daily reminder's time beside its switch: the workflow's, read-only.
  it('shows the daily reminder time on the training row only', async () => {
    render(<NotificationsForm />)
    const time = await screen.findByTestId('reminder-time')
    expect(time.textContent).toMatch(/^\d{2}:11$/)
    expect(screen.getAllByTestId('reminder-time')).toHaveLength(1)
    expect(time.parentElement!.parentElement!.textContent).toContain(t.settings.notifications.types.training.title)
  })
})
