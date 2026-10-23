import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from '../Sheet'
import { ActivityFilterSheet } from '@/components/activities/ActivityFilterSheet'

const css = readFileSync(path.resolve(__dirname, '../../../app/globals.css'), 'utf8')

describe('a sheet', () => {
  it.each(['medium', 'large'] as const)('is the same glass at a %s detent', (detent) => {
    render(<Sheet onClose={() => {}} title="Filter & sort" testId="sheet" detent={detent}>body</Sheet>)
    const sheet = screen.getByTestId('sheet')
    expect(sheet.className).toMatch(/\blg lg-sheet\b/)
    expect(sheet.className).not.toContain('bg-[var(--raised)]')
    expect([...sheet.querySelectorAll(':scope > i')].map((i) => i.className)).toEqual(['lg-blur', 'lg-edge', 'lg-tint'])
  })

  it('draws its header controls in the light translucent fill, never glass', () => {
    render(<Sheet onClose={() => {}} title="Filter & sort" action={{ label: 'Reset', onClick: () => {} }}>body</Sheet>)
    for (const name of ['Close', 'Reset']) {
      const button = screen.getByRole('button', { name })
      expect(button.className).toContain('bg-[var(--sheet-fill)]')
      expect(button.className).not.toMatch(/\blg\b/)
    }
  })

  it("takes a 28 % sheen, and its segmented controls the sheet's fills", () => {
    expect(css).toContain('linear-gradient(180deg, var(--glass-sheen) 0%, transparent 28%)')
    expect(css).toMatch(/\.lg-sheet \{\s+--segmented-track: var\(--sheet-fill\);/)
    expect(css).toMatch(/--sheet-glass-filter:\s+blur\(28px\) saturate\(2\);/)
    expect(css).toMatch(/--sheet-glass-filter:\s+blur\(28px\) saturate\(1\.8\);/)
  })

  it('dims the page in a tint of its ink in light, not a grey wash', () => {
    expect(css).toMatch(/--scrim-sheet:\s+rgb\(20 24 22 \/ 0\.16\);/)
    expect(css).toMatch(/--scrim-sheet:\s+rgb\(0 0 0 \/ 0\.45\);/)
  })
})

describe('Filter & sort', () => {
  it('rings an unticked type and fills a ticked one with the accent', () => {
    render(
      <ActivityFilterSheet types={['Tempo']} sort="newest" counts={new Map([['Tempo', 46], ['Base', 160]])} onApply={vi.fn()} onClose={() => {}} />,
    )
    const box = (name: RegExp) => screen.getByRole('checkbox', { name }).querySelector('span')!
    expect(box(/Tempo/).className).toContain('bg-accent')
    expect(box(/Base/).className).toContain('shadow-[inset_0_0_0_1.5px_var(--radio-ring)]')
    expect(box(/Base/).className).not.toContain('fill-3')
  })
})
