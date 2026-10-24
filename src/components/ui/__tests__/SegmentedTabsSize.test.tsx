import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SegmentedTabs, useSegmentedTabs } from '../SegmentedTabs'
import { StickyStuckContext } from '../StickyBar'

function Tabs({ size }: { size?: 'sm' | 'md' }) {
  const tabs = useSegmentedTabs({ ids: ['a', 'b'] as const, value: 'a', onChange: () => {} })
  return <SegmentedTabs tabs={tabs} items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} label="Tabs" size={size} fill />
}

describe('SegmentedTabs sizes', () => {
  it('draws sm at 26 and md at 34 in a borderless capsule, with a 44 pt hit area either way', () => {
    const { rerender } = render(<Tabs size="sm" />)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('h-[26px]')
      expect(tab.className).toContain('text-[13px]')
      expect(tab.className).toContain('hit-44')
    }

    rerender(<Tabs size="md" />)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('h-[34px]')
      expect(tab.className).toContain('text-[15px]')
      expect(tab.className).toContain('rounded-full')
    }
    const track = screen.getByRole('tablist').className
    expect(track).toContain('rounded-full')
    expect(track).toContain('p-[3px]')
    expect(track).not.toMatch(/\bborder\b/)
  })

  it('draws the glass variant as a 44 pt .lg capsule with its layers', () => {
    function Glassy() {
      const tabs = useSegmentedTabs({ ids: ['a', 'b'] as const, value: 'a', onChange: () => {} })
      return <SegmentedTabs tabs={tabs} items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} label="Tabs" barMirror />
    }
    render(<Glassy />)
    const list = screen.getByRole('tablist')
    expect(list.className).toMatch(/\blg\b/)
    expect(list.className).toContain('h-11')
    expect([...list.querySelectorAll(':scope > i')].map((i) => i.className)).toEqual(['lg-blur', 'lg-edge', 'lg-tint'])
    expect(screen.getByRole('tab', { name: 'A' }).className).toContain('bg-[var(--tab-pill)]')
    expect(list.className).not.toContain('lg-stuck-in')
  })

  it("turns a pinned strip's control to glass that fades in, and back to the track", () => {
    const { rerender } = render(<StickyStuckContext.Provider value={false}><Tabs size="md" /></StickyStuckContext.Provider>)
    const list = () => screen.getByRole('tablist')
    expect(list().dataset.variant).toBe('content')
    expect(list().className).not.toMatch(/\blg\b|lg-stuck-in/)

    rerender(<StickyStuckContext.Provider value={true}><Tabs size="md" /></StickyStuckContext.Provider>)
    expect(list().dataset.variant).toBe('glass')
    expect(list().className).toMatch(/\blg\b/)
    expect(list().className).toContain('lg-stuck-in')
    expect(list().querySelectorAll(':scope > i')).toHaveLength(3)

    rerender(<StickyStuckContext.Provider value={false}><Tabs size="md" /></StickyStuckContext.Provider>)
    expect(list().dataset.variant).toBe('content')
    expect(list().querySelectorAll(':scope > i')).toHaveLength(0)
  })

  // A snapshot, so a refactor can't drop fill mode unseen.
  it('keeps fill mode whole (snapshot)', () => {
    render(<Tabs size="md" />)
    const list = screen.getByRole('tablist')
    expect({
      track: list.className,
      tabs: screen.getAllByRole('tab').map((tab) => tab.className),
    }).toMatchInlineSnapshot(`
      {
        "tabs": [
          "hit-44 flex items-center justify-center whitespace-nowrap transition-colors h-[34px] text-[15px] tracking-[-0.015rem] min-w-0 flex-auto px-1.5 min-[400px]:px-2.5 sm:px-3 rounded-full bg-[var(--segmented-pill)] font-semibold text-foreground shadow-[var(--segmented-pill-shadow)]",
          "hit-44 flex items-center justify-center whitespace-nowrap transition-colors h-[34px] text-[15px] tracking-[-0.015rem] min-w-0 flex-auto px-1.5 min-[400px]:px-2.5 sm:px-3 rounded-full font-medium text-[var(--text-2)] hover:text-foreground",
        ],
        "track": "flex shrink-0 gap-0.5 rounded-full p-[3px] bg-[var(--segmented-track)] w-full",
      }
    `)
  })

  it('frosts its track on the background glow', () => {
    function OnAura() {
      const tabs = useSegmentedTabs({ ids: ['a', 'b'] as const, value: 'a', onChange: () => {} })
      return <SegmentedTabs tabs={tabs} items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} label="Tabs" size="md" onAura />
    }
    render(<OnAura />)
    const track = screen.getByRole('tablist').className
    expect(track).toMatch(/(^|\s)on-aura(\s|$)/)
    expect(track).not.toContain('bg-[var(--segmented-track)]')
  })
})
