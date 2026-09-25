import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SegmentedTabs, useSegmentedTabs } from '../SegmentedTabs'

function Tabs({ size }: { size?: 'sm' | 'md' }) {
  const tabs = useSegmentedTabs({ ids: ['a', 'b'] as const, value: 'a', onChange: () => {} })
  return <SegmentedTabs tabs={tabs} items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} label="Tabs" size={size} fill />
}

describe('SegmentedTabs sizes', () => {
  // Four recipes ranged from 36 to 48 pt; the sizes are 32 and 40, each with a
  // 44 pt hit area.
  it('draws sm at 32 and md at 40, with a 44 pt hit area either way', () => {
    const { rerender } = render(<Tabs size="sm" />)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('h-8')
      expect(tab.className).toContain('hit-44')
    }

    rerender(<Tabs size="md" />)
    for (const tab of screen.getAllByRole('tab')) expect(tab.className).toContain('h-10')
  })

  it('stretches across the row when asked to fill', () => {
    render(<Tabs size="md" />)

    expect(screen.getByRole('tablist').className).toContain('w-full')
    expect(screen.getAllByRole('tab')[0]!.className).toContain('flex-1')
  })
})
