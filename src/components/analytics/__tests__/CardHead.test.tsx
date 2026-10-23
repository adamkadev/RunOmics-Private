import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardHead } from '../AnalyticsKit'
import { t } from '@/i18n'

// A caption sits on the title's line, at the right, only while it fits there whole; otherwise under the title, from
// the left.
describe('a card head', () => {
  it('lets the caption sit right of the title or drop under it from the left, never wrapped at the right', () => {
    render(<CardHead title="Temperature cost" caption={t.analytics.cards.heatCost.caption(149)} />)
    const caption = screen.getByText(t.analytics.cards.heatCost.caption(149))
    const row = caption.parentElement!
    // A wrapping row whose lone item on a line starts at the left.
    expect(row.className).toContain('flex-wrap')
    expect(row.className).toContain('justify-between')
    expect(caption.className).not.toMatch(/\bml-auto\b|\btext-right\b/)
    expect(caption.className).toContain('text-left')
    expect(caption.className).toContain('text-[13px]')
    expect(caption.className).toContain('text-muted-foreground')
  })

  it('says what the temperature bars are measured against in one sentence-case line', () => {
    expect(t.analytics.cards.heatCost.caption(149)).toBe('Pace at 149 bpm vs your best band')
  })
})
