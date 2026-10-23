import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { t } from '@/i18n'
import { menuPlacement } from '../chipMenu'
import { ClusterPanel } from '../ClusterPanel'

function AreaPicker() {
  return (
    <ClusterPanel
      rows={[
        { idx: 0, runs: 12, km: 96, sharePercent: 82 },
        { idx: 1, runs: 3, km: 21, sharePercent: 18 },
      ]}
      names={['Riverside', 'Old town']}
      selectedIdx={0}
      onSelect={() => {}}
    />
  )
}

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

/** A rail that scrolls sideways clips on both axes. */
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
    const rail = inScrollingRail(<AreaPicker />)

    const { chip, menu } = openMenu(new RegExp(t.pages.map.area))

    expect(chip).toHaveAttribute('aria-expanded', 'true')
    expect(rail.contains(menu)).toBe(false)
    expect(menu.parentElement).toBe(document.body)
    expect(menu).toHaveTextContent('Old town')
  })

  it('close on a tap outside, but not on one inside the menu', () => {
    inScrollingRail(<AreaPicker />)
    const { chip, menu } = openMenu(new RegExp(t.pages.map.area))

    fireEvent.pointerDown(menu)
    expect(chip).toHaveAttribute('aria-expanded', 'true')

    fireEvent.pointerDown(document.body)
    expect(chip).toHaveAttribute('aria-expanded', 'false')
  })

  it('close on Escape and hand the focus back to the chip', () => {
    inScrollingRail(<AreaPicker />)
    const { chip } = openMenu(new RegExp(t.pages.map.area))

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(chip).toHaveAttribute('aria-expanded', 'false')
    expect(chip).toHaveFocus()
  })

  it('follow their chip when the rail scrolls, rather than closing', () => {
    // The tap that opens a chip partly outside the rail scrolls it into view
    // after the menu has opened.
    const rail = inScrollingRail(<AreaPicker />)
    const { chip, menu } = openMenu(new RegExp(t.pages.map.area))
    vi.spyOn(chip, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 200, bottom: 50 } as DOMRect)

    fireEvent.scroll(rail)

    expect(chip).toHaveAttribute('aria-expanded', 'true')
    expect(menu.style.top).toBe('54px')
    expect(menu.style.left).toBe('100px')
  })

  it('draw the area as a glass pill that takes the room left and cuts a long name', () => {
    render(<AreaPicker />)
    const chip = screen.getByRole('button', { name: new RegExp(t.pages.map.area) })
    expect(chip.className).toMatch(/(^|\s)lg(\s|$)/)
    expect(chip.className).toContain('flex-1')
    expect(chip.className).toContain('min-w-0')
    expect(chip.querySelector('span.truncate')!.textContent).toBe('Riverside')
  })

  it('open the area list under the start of its chip, and close it from its own button', () => {
    inScrollingRail(<AreaPicker />)
    const { chip, menu } = openMenu(new RegExp(t.pages.map.area))

    expect(menu.style.left).not.toBe('')
    expect(menu.style.right).toBe('')
    expect(menu).toHaveTextContent('82%')
    fireEvent.click(screen.getByRole('button', { name: t.common.close }))
    expect(chip).toHaveAttribute('aria-expanded', 'false')
  })

  it('fold the small areas into one row that opens in place', () => {
    const rows = [
      { idx: 0, runs: 142, km: 1216, sharePercent: 49 },
      { idx: 1, runs: 129, km: 1067, sharePercent: 43 },
      { idx: 2, runs: 15, km: 120, sharePercent: 5 },
      { idx: 3, runs: 8, km: 79, sharePercent: 3 },
    ]
    inScrollingRail(<ClusterPanel rows={rows} names={['Metz', 'Strasbourg', 'George Town', 'Nancy']} selectedIdx={0} onSelect={() => {}} />)
    const { menu } = openMenu(new RegExp(t.pages.map.area))

    expect(menu).toHaveTextContent('2 more areas')
    expect(menu).toHaveTextContent('incl. George Town')
    expect(menu).not.toHaveTextContent('Nancy')
    fireEvent.click(screen.getByRole('button', { name: /2 more areas/ }))
    expect(menu).toHaveTextContent('Nancy')
  })
})
