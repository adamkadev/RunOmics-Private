import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationsForm } from '@/components/settings/NotificationsForm'
import { t } from '@/i18n'

vi.mock('@/lib/pushNotifications', () => ({
  isPushSupported: () => Promise.resolve(false),
  enablePushNotifications: vi.fn(),
  disablePushNotifications: vi.fn(),
}))

describe('NotificationsForm (v4.17)', () => {
  it('draws each alert as a row with the shared switch, named for the alert', async () => {
    render(<NotificationsForm />)
    const n = t.settings.notifications.types
    for (const type of [n.training, n.shoes, n.races]) {
      const toggle = await screen.findByRole('switch', { name: type.title })
      expect(toggle.getAttribute('aria-checked')).toBe('false')
      // Off is line-2, a choice - never drawn as disabled.
      expect(toggle.className).toContain('bg-[var(--line-2)]')
      expect(screen.getByText(type.subtitle)).toBeInTheDocument()
    }
    await vi.waitFor(() => expect(screen.getAllByRole('switch').every((s) => !(s as HTMLButtonElement).disabled)).toBe(true))
  })
})
