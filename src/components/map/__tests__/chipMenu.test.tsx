import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { RouteCluster } from '@/application/usecases/GetAllRoutes'
import { t } from '@/i18n'
import { menuPlacement } from '../chipMenu'
import { ClusterPanel } from '../ClusterPanel'
import { TypePicker } from '../TypePicker'
import { YearPicker } from '../YearPicker'

describe('menuPlacement', () => {
  const viewport = { width: 390, height: 844 }

  it('opens just under the chip, lined up with the edge it is asked for', () => {
    expect(menuPlacement({ left: 200, right: 300, bottom: 420 }, 'end', viewport)).toEqual({
      position: 'fixed',
      top: 424,
      right: 90,
      maxHeight: 412,
      maxWidth: 292,
    })
    expect(menuPlacement({ left: 20, right: 180, bottom: 420 }, 'start', viewport)).toMatchObject({ top: 424, left: 20 })
  })

  it('stays 8px inside the viewport when the rail has scrolled the chip half out of it', () => {
    expect(menuPlacement({ left: -40, right: 60, bottom: 100 }, 'start', viewport)).toMatchObject({ left: 8 })
    expect(menuPlacement({ left: 330, right: 430, bottom: 100 }, 'end', viewport)).toMatchObject({ right: 8 })
  })

  it('is never taller than the room left below the chip', () => {
    expect(menuPlacement({ left: 0, right: 100, bottom: 800 }, 'start', viewport).maxHeight).toBe(32)
    expect(menuPlacement({ left: 0, right: 100, bottom: 900 }, 'start', viewport).maxHeight).toBe(0)
  })
})

/** The map's chips sit in a rail that scrolls sideways - and so clips on both axes. */
function inScrollingRail(ui: React.ReactElement) {
  render(
    <div data-testid="rail" style={{ overflowX: 'auto' }}>
      {ui}
    </div>
  )
  return screen.getByTestId('rail')
}

function openMenu(chipName: string | RegExp) {
  const chip = screen.getByRole('button', { name: chipName })
  fireEvent.click(chip)
  const menu = document.getElementById(chip.getAttribute('aria-controls') ?? '')
  if (!menu) throw new Error('the chip opened no menu')
  return { chip, menu }
}

describe('the map filter chips', () => {
  it('draw their menu outside the scrolling rail, where it cannot be clipped', () => {
    const rail = inScrollingRail(<YearPicker years={['2025', '2026']} value={null} onChange={() => {}} />)

    const { chip, menu } = openMenu(t.pages.map.allYears)

    expect(chip).toHaveAttribute('aria-expanded', 'true')
    expect(rail.contains(menu)).toBe(false)
    expect(menu.parentElement).toBe(document.body)
    expect(menu).toHaveTextContent('2026')
  })

  it('pick an option and close', () => {
    const onChange = vi.fn()
    inScrollingRail(<TypePicker types={['Base', 'Tempo']} value={null} onChange={onChange} />)

    const { chip, menu } = openMenu(t.pages.map.allTypes)
    fireEvent.click(menu.querySelectorAll('button')[2]!)

    expect(onChange).toHaveBeenCalledWith('Tempo')
    expect(chip).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(menu.id)).toBeNull()
  })

  it('close on a tap outside, but not on one inside the menu', () => {
    inScrollingRail(<YearPicker years={['2026']} value={null} onChange={() => {}} />)
    const { chip, menu } = openMenu(t.pages.map.allYears)

    fireEvent.pointerDown(menu)
    expect(chip).toHaveAttribute('aria-expanded', 'true')

    fireEvent.pointerDown(document.body)
    expect(chip).toHaveAttribute('aria-expanded', 'false')
  })

  it('close on Escape and hand the focus back to the chip', () => {
    inScrollingRail(<YearPicker years={['2026']} value={null} onChange={() => {}} />)
    const { chip } = openMenu(t.pages.map.allYears)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(chip).toHaveAttribute('aria-expanded', 'false')
    expect(chip).toHaveFocus()
  })

  it('follow their chip when the rail scrolls, rather than closing', () => {
    // A chip partly outside the rail is scrolled into view by the tap that
    // opens it, and that scroll arrives after the menu has opened.
    const rail = inScrollingRail(<YearPicker years={['2026']} value={null} onChange={() => {}} />)
    const { chip, menu } = openMenu(t.pages.map.allYears)
    vi.spyOn(chip, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 200, bottom: 50 } as DOMRect)

    fireEvent.scroll(rail)

    expect(chip).toHaveAttribute('aria-expanded', 'true')
    expect(menu.style.top).toBe('54px')
    expect(menu.style.right).toBe(`${window.innerWidth - 200}px`)
  })

  it('open the zone list under the start of its chip, and close it from its own button', () => {
    const clusters = [{ id: 'a' }, { id: 'b' }] as RouteCluster[]
    inScrollingRail(
      <ClusterPanel
        clusters={clusters}
        names={['Riverside', 'Old town']}
        stats={[
          { routeCount: 12, totalKm: 96 },
          { routeCount: 3, totalKm: 21 },
        ]}
        selectedIdx={0}
        onSelect={() => {}}
      />
    )
    const { chip, menu } = openMenu(new RegExp(t.pages.map.zones))

    expect(menu.style.left).not.toBe('')
    expect(menu.style.right).toBe('')
    fireEvent.click(screen.getByRole('button', { name: t.common.close }))
    expect(chip).toHaveAttribute('aria-expanded', 'false')
  })
})
