import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SessionCard, SessionStateChip } from '../SessionCard'
import { t } from '@/i18n'

describe('SessionStateChip', () => {
  it('says each state in words, in its own tone', () => {
    const { rerender, container } = render(<SessionStateChip state="done" />)
    const done = screen.getByText(t.sessionState.done)
    expect(done.className).toContain('text-delta-good')
    expect(container.querySelector('svg.lucide-check')).not.toBeNull()

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

  it('has no control at all without a destination', () => {
    render(<SessionCard state="rest" title="Rest day" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
