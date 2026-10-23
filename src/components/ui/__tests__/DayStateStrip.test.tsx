import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DayStateStrip, type DayStateCell } from '../DayStateStrip'
import { t } from '@/i18n'

function cell(date: string, overrides: Partial<DayStateCell> = {}): DayStateCell {
  return { date, label: 'M', fullLabel: date, state: 'rest', color: '#ff9a5a', km: null, isToday: false, ...overrides }
}

const WEEK: DayStateCell[] = [
  cell('2026-09-21', { state: 'missed', km: 11 }),
  cell('2026-09-22', { state: 'done', km: 9 }),
  cell('2026-09-23', { state: 'planned', km: 13, isToday: true }),
  cell('2026-09-24'),
]

const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('the session state recipes', () => {
  it('draws each state as a shape and takes its colour from --state-color', () => {
    expect(css).toMatch(/@utility state-done \{\s+background: var\(--state-color\);/)
    expect(css).toMatch(/@utility state-planned \{\s+border: var\(--state-line\) dashed var\(--state-color\);/)
    expect(css).toMatch(/@utility state-missed \{\s+border: var\(--state-line\) solid var\(--state-color\);\s+background: repeating-linear-gradient\(\s+135deg/)
    expect(css).toMatch(/@utility state-today \{\s+outline: var\(--state-ring\) solid var\(--accent\);\s+outline-offset: var\(--state-ring\);/)
    expect(css).toMatch(/--state-ring:\s+2px/)
  })
})

describe('DayStateStrip', () => {
  it('gives missed, done and planned days three different shapes', () => {
    const { container } = render(<DayStateStrip variant="bars" days={[...WEEK, cell('2026-09-25', { state: 'planned', km: 12 })]} />)
    const bars = [...container.querySelectorAll('button > span:nth-child(2)')]

    expect(bars[0]!.className).toContain('state-missed')
    expect(bars[1]!.className).toContain('state-done')
    expect(bars[3]!.className).toContain('state-rest')
    expect(bars[4]!.className).toContain('state-planned')
  })

  it('outlines today solid and caps no done day', () => {
    const { container } = render(<DayStateStrip variant="bars" days={[...WEEK, cell('2026-09-26', { state: 'done', km: 10.24 })]} />)
    const bars = [...container.querySelectorAll('button > span:nth-child(2)')]

    expect(bars[2]!.className).toContain('today-bar')
    expect(bars[2]!.className).not.toContain('state-planned')
    expect(bars[1]!.children).toHaveLength(0)
    expect(container.textContent).toContain('10.2')
    expect(container.textContent).not.toContain(t.sessionState.rest.toLowerCase())
  })

  it('fills today with the accent and its km, and draws no other glyph', () => {
    const { container } = render(<DayStateStrip variant="dots" days={WEEK} />)
    const marks = [...container.querySelectorAll('li > span:first-child')]

    expect(marks[2]!.className).toContain('today-bar')
    expect(marks[2]!.className).not.toContain('bg-accent')
    expect(marks[2]!.textContent).toBe('13')
    expect(marks.filter((m) => m.hasAttribute('data-today-outline'))).toHaveLength(1)
    expect(marks.filter((_, i) => i !== 2).every((m) => m.textContent === '')).toBe(true)
  })

  it('names each day and its state', () => {
    render(<DayStateStrip variant="dots" days={WEEK} />)

    expect(screen.getByLabelText(t.sessionState.dayLabel('2026-09-21', t.sessionState.missed))).toBeInTheDocument()
    expect(
      screen.getByLabelText(t.sessionState.dayLabel('2026-09-23', `${t.sessionState.planned} · ${t.sessionState.today}`)),
    ).toBeInTheDocument()
  })

  it('selects a day from the bars', async () => {
    const onSelect = vi.fn()
    render(<DayStateStrip variant="bars" days={WEEK} selectedDate="2026-09-22" onSelect={onSelect} />)

    await userEvent.click(screen.getByLabelText(t.sessionState.dayLabel('2026-09-21', t.sessionState.missed)))
    expect(onSelect).toHaveBeenCalledWith('2026-09-21')
    expect(screen.getByLabelText(t.sessionState.dayLabel('2026-09-22', t.sessionState.done))).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks a missed km in the warning colour', () => {
    render(<DayStateStrip variant="bars" days={WEEK} />)

    expect(screen.getByText('11').className).toContain('text-delta-warn')
  })
})
