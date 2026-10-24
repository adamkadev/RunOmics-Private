import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FORM_BAND_THRESHOLDS } from '@/domain/training/formBand'
import { t } from '@/i18n'
import { GlossaryTerm, glossaryDefinition, type GlossaryKey } from '../GlossaryTerm'

const TERMS: GlossaryKey[] = ['form', 'fitness', 'fatigue', 'vma', 'lthr', 'thresholdPace', 'rpe', 'aerobicEffect', 'anaerobicEffect']

describe('glossaryDefinition', () => {
  it('has one definition for every term the audit named', () => {
    for (const term of TERMS) expect(glossaryDefinition(term).length, term).toBeGreaterThan(20)
  })

  it("defines Form with the bands' own thresholds", () => {
    expect(glossaryDefinition('form')).toContain(String(FORM_BAND_THRESHOLDS.tiredBelow))
    expect(glossaryDefinition('form')).toContain(`+${FORM_BAND_THRESHOLDS.veryFreshAbove}`)
  })
})

describe('GlossaryTerm', () => {
  it('keeps the definition behind an (i) until it is asked for', async () => {
    render(<GlossaryTerm term="vma">VMA</GlossaryTerm>)
    const info = screen.getByRole('button', { name: t.glossary.about(t.glossary.vma.term) })

    expect(info).toHaveAttribute('aria-expanded', 'false')
    expect(info.className).toContain('hit-44')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()

    await userEvent.click(info)
    expect(info).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('note')).toHaveTextContent(t.glossary.vma.definition)
  })
})
