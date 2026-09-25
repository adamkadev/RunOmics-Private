import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SessionCard, SessionStateChip } from '../SessionCard'
import { t } from '@/i18n'

describe('SessionStateChip', () => {
  it('says each state in words, in its own tone', () => {
    const { rerender } = render(<SessionStateChip state="done" />)
    expect(screen.getByText(`✓ ${t.sessionState.done}`).className).toContain('text-delta-good')

    rerender(<SessionStateChip state="missed" />)
    expect(screen.getByText(t.sessionState.missed).className).toContain('text-delta-warn')

    rerender(<SessionStateChip state="planned" />)
    expect(screen.getByText(t.sessionState.planned).className).toContain('text-subtle')
  })
})

describe('SessionCard', () => {
  it('is a link with a chevron when it has somewhere to go', () => {
    render(<SessionCard state="done" title="Threshold" detail="Ran 6.11 km" href="/activities/a1" />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/activities/a1')
  })

  // Read-only: everything comes from Garmin, so there is nothing to press
  // without a destination.
  it('has no control at all without a destination', () => {
    render(<SessionCard state="rest" title="Rest day" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
