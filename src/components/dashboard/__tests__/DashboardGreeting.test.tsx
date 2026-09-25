import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { DashboardGreeting } from '../DashboardGreeting'

describe('DashboardGreeting', () => {
  // The avatar looked tappable and was a plain div.
  it('makes the avatar a 44 pt link to Progress', () => {
    render(<DashboardGreeting name="Adam" />)
    const link = screen.getByRole('link', { name: t.nav.items.profile })

    expect(link).toHaveAttribute('href', '/profile')
    // The disc is 34 pt; hit-44 grows its target without growing the row.
    expect(link.className).toContain('hit-44')
    expect(link.className).toContain('size-8.5')
  })
})
