import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { LayersButton } from '../LayersButton'
import { DistrictsLegend } from '../DistrictsLegend'

describe('LayersButton', () => {
  it('is a toggle named for the Districts layer, pressed while it shows', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<LayersButton on={false} onToggle={onToggle} />)
    const button = screen.getByRole('button', { name: t.pages.map.districts.layersButton })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)

    rerender(<LayersButton on onToggle={onToggle} />)
    expect(screen.getByRole('button', { name: t.pages.map.districts.layersButton })).toHaveAttribute('aria-pressed', 'true')
  })

  it('is a 44 pt glass circle, tinted with the accent and ringed only while on', () => {
    const { rerender } = render(<LayersButton on={false} onToggle={() => {}} />)
    const button = screen.getByTestId('layers-button')
    expect(button).toHaveClass('lg', 'size-11', 'text-foreground')
    expect(button.querySelector('.lg-blur')).not.toBeNull()
    expect(button.style.getPropertyValue('--glass-fill')).toBe('')

    rerender(<LayersButton on onToggle={() => {}} />)
    expect(button).toHaveClass('text-accent-text')
    expect(button).not.toHaveClass('text-foreground')
    expect(button.style.getPropertyValue('--glass-fill')).toContain('var(--accent) 24%')
    expect(button.style.boxShadow).toContain('var(--glass-drop)')
  })

  it('draws the two-tier layers glyph of the mockups at 22 pt', () => {
    render(<LayersButton on={false} onToggle={() => {}} />)
    const icon = screen.getByTestId('layers-button').querySelector('svg')!
    expect(icon).toHaveClass('lucide-layers-2')
    expect(icon.querySelectorAll('path')).toHaveLength(2)
    expect(icon).toHaveAttribute('width', '22')
  })
})

describe('DistrictsLegend', () => {
  it('names the three states, in order', () => {
    render(<DistrictsLegend />)
    const legend = screen.getByTestId('districts-legend')
    expect(legend).toHaveAccessibleName(t.pages.map.districts.legend)
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      t.pages.map.districts.fog,
      t.pages.map.districts.partly,
      t.pages.map.districts.complete,
    ])
    expect([...legend.querySelectorAll('[data-swatch]')].map((s) => s.getAttribute('data-swatch'))).toEqual(['fog', 'partly', 'complete'])
  })

  it('is solid, not glass: no blur of its own (the blur budget)', () => {
    render(<DistrictsLegend />)
    const legend = screen.getByTestId('districts-legend')
    expect(legend).not.toHaveClass('lg')
    expect(legend.querySelector('.lg-blur, .lg-edge')).toBeNull()
    expect(legend).toHaveClass('bg-[var(--raised)]', 'h-9')
  })

  it('has the solid glass’s hairline rim in dark, where the drop alone left no edge on the map', () => {
    render(<DistrictsLegend />)
    const legend = screen.getByTestId('districts-legend')
    expect(legend).toHaveClass('shadow-[var(--glass-drop)]', 'dark:shadow-[inset_0_0_0_1px_var(--border),var(--glass-drop)]')
  })

  it('in light mono, draws the complete swatch as a lifted, outlined square, not a grey one like the fog', () => {
    render(<DistrictsLegend />)
    const complete = screen.getByTestId('districts-legend').querySelector('[data-swatch="complete"]')!
    expect(complete.className).toContain('[:root[data-accent=mono]:not(.dark)_&]:bg-[var(--raised)]')
  })
})
