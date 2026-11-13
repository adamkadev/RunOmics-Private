import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { t } from '@/i18n'
import { HeatFilterSheet } from '../HeatFilterSheet'
import { NO_HEAT_FILTERS, type HeatFilters } from '../mapUtils'

const f = t.pages.map.filters

/** Two runs per type and year: eight in all. */
const count = (filters: HeatFilters) => (filters.types.length || 2) * (filters.years.length || 2) * 2

function open(onApply = vi.fn(), value: HeatFilters = NO_HEAT_FILTERS) {
  render(<HeatFilterSheet types={['Base', 'Tempo']} years={['2026', '2025']} place="Hoenheim" value={value} count={count} onApply={onApply} onClose={() => {}} />)
  const sheet = screen.getByRole('dialog', { name: f.title })
  const section = (title: string) => within(within(sheet).getByRole('region', { name: title }))
  return { sheet, types: section(t.pages.map.type), years: section(t.pages.map.year), onApply }
}

describe('the heatmap filters sheet', () => {
  it('lights "All" while nothing is ticked, and counts every run', () => {
    const { sheet, types, years } = open()
    expect(types.getByRole('button', { name: f.all })).toHaveAttribute('aria-pressed', 'true')
    expect(years.getByRole('button', { name: f.all })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByRole('button', { name: f.show(8, 'Hoenheim') })).toBeInTheDocument()
  })

  it('ticks several types or years, counts what they show, and "All" clears its section', () => {
    const { sheet, types, years } = open()
    fireEvent.click(types.getByRole('button', { name: t.activityTypes.Tempo }))
    fireEvent.click(years.getByRole('button', { name: '2026' }))
    expect(types.getByRole('button', { name: f.all })).toHaveAttribute('aria-pressed', 'false')
    expect(types.getByRole('button', { name: t.activityTypes.Tempo })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByRole('button', { name: f.show(2, 'Hoenheim') })).toBeInTheDocument()

    fireEvent.click(years.getByRole('button', { name: '2025' }))
    expect(within(sheet).getByRole('button', { name: f.show(4, 'Hoenheim') })).toBeInTheDocument()

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
    fireEvent.click(within(sheet).getByRole('button', { name: f.show(8, 'Hoenheim') }))
    expect(onApply).toHaveBeenCalledWith(NO_HEAT_FILTERS)
    act(() => { vi.runAllTimers() })
    vi.useRealTimers()
  })

  it('keeps Reset off until a filter is ticked, and names the area the count is of', () => {
    const { sheet, years } = open()
    expect(within(sheet).getByRole('button', { name: f.reset })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: 'Show 8 runs in Hoenheim' })).toBeInTheDocument()
    fireEvent.click(years.getByRole('button', { name: '2026' }))
    expect(within(sheet).getByRole('button', { name: f.reset })).toBeEnabled()
  })

  it('leaves the type section out when the runs have one type', () => {
    render(<HeatFilterSheet types={['Base']} years={['2026']} place={null} value={NO_HEAT_FILTERS} count={() => 3} onApply={() => {}} onClose={() => {}} />)
    expect(screen.queryByRole('region', { name: t.pages.map.type })).toBeNull()
    expect(screen.getByRole('region', { name: t.pages.map.year })).toBeInTheDocument()
  })

  it('switches the layer at once from the same sheet', () => {
    const onToggle = vi.fn()
    render(<HeatFilterSheet types={['Base']} years={['2026']} place={null} value={NO_HEAT_FILTERS} count={count} onApply={vi.fn()} onClose={() => {}} layer={{ districts: false, onToggle }} />)
    expect(screen.getByTestId('layer-heat')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('layer-heat'))
    expect(onToggle).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('layer-districts'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
