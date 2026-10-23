import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { t } from '@/i18n'
import { HeatFilterSheet } from '../HeatFilterSheet'
import { NO_HEAT_FILTERS, type HeatFilters } from '../mapUtils'

const f = t.pages.map.filters

/** Two runs per type and year: eight in all. */
const count = (filters: HeatFilters) => (filters.types.length || 2) * (filters.years.length || 2) * 2

function open(onApply = vi.fn(), value: HeatFilters = NO_HEAT_FILTERS) {
  render(<HeatFilterSheet types={['Base', 'Tempo']} years={['2026', '2025']} value={value} count={count} onApply={onApply} onClose={() => {}} />)
  const sheet = screen.getByRole('dialog', { name: f.title })
  const section = (title: string) => within(within(sheet).getByRole('region', { name: title }))
  return { sheet, types: section(t.pages.map.type), years: section(t.pages.map.year), onApply }
}

describe('the heatmap filters sheet', () => {
  it('lights "All" while nothing is ticked, and counts every run', () => {
    const { sheet, types, years } = open()
    expect(types.getByRole('button', { name: f.all })).toHaveAttribute('aria-pressed', 'true')
    expect(years.getByRole('button', { name: f.all })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByRole('button', { name: f.show(8) })).toBeInTheDocument()
  })

  it('ticks several types or years, counts what they show, and "All" clears its section', () => {
    const { sheet, types, years } = open()
    fireEvent.click(types.getByRole('button', { name: t.activityTypes.Tempo }))
    fireEvent.click(years.getByRole('button', { name: '2026' }))
    expect(types.getByRole('button', { name: f.all })).toHaveAttribute('aria-pressed', 'false')
    expect(types.getByRole('button', { name: t.activityTypes.Tempo })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByRole('button', { name: f.show(2) })).toBeInTheDocument()

    fireEvent.click(years.getByRole('button', { name: '2025' }))
    expect(within(sheet).getByRole('button', { name: f.show(4) })).toBeInTheDocument()

    fireEvent.click(years.getByRole('button', { name: f.all }))
    expect(years.getByRole('button', { name: '2026' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('applies only on "Show N runs", and Reset clears every section', () => {
    vi.useFakeTimers()
    const { sheet, types, onApply } = open(vi.fn(), { types: ['Base'], years: ['2025'] })
    expect(types.getByRole('button', { name: t.activityTypes.Base })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(types.getByRole('button', { name: t.activityTypes.Tempo }))
    expect(onApply).not.toHaveBeenCalled()

    fireEvent.click(within(sheet).getByRole('button', { name: f.reset }))
    expect(types.getByRole('button', { name: f.all })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(sheet).getByRole('button', { name: f.show(8) }))
    expect(onApply).toHaveBeenCalledWith(NO_HEAT_FILTERS)
    act(() => { vi.runAllTimers() })
    vi.useRealTimers()
  })

  it('leaves the type section out when the runs have one type', () => {
    render(<HeatFilterSheet types={['Base']} years={['2026']} value={NO_HEAT_FILTERS} count={() => 3} onApply={() => {}} onClose={() => {}} />)
    expect(screen.queryByRole('region', { name: t.pages.map.type })).toBeNull()
    expect(screen.getByRole('region', { name: t.pages.map.year })).toBeInTheDocument()
  })
})
