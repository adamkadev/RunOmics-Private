import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SegmentedTabs, useSegmentedTabs } from '../SegmentedTabs'

function Tabs({ size }: { size?: 'sm' | 'md' }) {
  const tabs = useSegmentedTabs({ ids: ['a', 'b'] as const, value: 'a', onChange: () => {} })
  return <SegmentedTabs tabs={tabs} items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} label="Tabs" size={size} fill />
}

describe('SegmentedTabs sizes', () => {
  // Four recipes ranged from 36 to 48 pt; the sizes are 30 (small ranges)
  // and 36 (page tabs), v4.17, each with a 44 pt hit area.
  it('draws sm at 30 and md at 36, with a 44 pt hit area either way', () => {
    const { rerender } = render(<Tabs size="sm" />)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('h-[30px]')
      expect(tab.className).toContain('hit-44')
    }

    rerender(<Tabs size="md" />)
    for (const tab of screen.getAllByRole('tab')) expect(tab.className).toContain('h-9')
  })

  it('stretches across the row when asked to fill', () => {
    render(<Tabs size="md" />)

    expect(screen.getByRole('tablist').className).toContain('w-full')
    // G21: the spare width is shared out on top of each label, 12 pt padding the floor.
    expect(screen.getAllByRole('tab')[0]!.className).toContain('flex-auto')
    expect(screen.getAllByRole('tab')[0]!.className).toContain('px-3')
  })
})
