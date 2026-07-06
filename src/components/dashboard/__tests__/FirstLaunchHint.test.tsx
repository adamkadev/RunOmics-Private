import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FirstLaunchHint } from '@/components/dashboard/FirstLaunchHint'
import { t } from '@/i18n'

describe('FirstLaunchHint', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows the hint on first visit', () => {
    render(<FirstLaunchHint />)
    expect(screen.getByText(t.dashboard.onboarding.message)).toBeInTheDocument()
  })

  it('hides and remembers dismissal', () => {
    render(<FirstLaunchHint />)
    fireEvent.click(screen.getByLabelText(t.common.close))
    expect(screen.queryByText(t.dashboard.onboarding.message)).toBeNull()
    expect(window.localStorage.getItem('ro-onboarding-seen')).toBe('1')
  })

  it('does not show again once already seen', () => {
    window.localStorage.setItem('ro-onboarding-seen', '1')
    render(<FirstLaunchHint />)
    expect(screen.queryByText(t.dashboard.onboarding.message)).toBeNull()
  })
})
