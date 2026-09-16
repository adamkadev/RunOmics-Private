import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileShoes } from '@/components/profile/ProfileShoes'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { t } from '@/i18n'

function shoe(over: Partial<ShoeStats>): ShoeStats {
  return {
    gearId: 'gear-1',
    name: 'Cloudrun 4',
    brand: 'Nimbus',
    maxKm: 800,
    alertThresholdKm: 640,
    retired: false,
    totalKm: 120,
    sessionCount: 12,
    lastUsedDate: '2026-09-10',
    wearPercent: 15,
    nearingLimit: false,
    ...over,
  }
}

describe('ProfileShoes', () => {
  it('carries the mileage of every pair, most-worn first, instead of a constant', () => {
    render(
      <ProfileShoes
        shoes={[
          shoe({ gearId: 'a', totalKm: 603.7, maxKm: 1000, wearPercent: 60 }),
          shoe({ gearId: 'b', totalKm: 53.2, maxKm: 800, wearPercent: 7 }),
        ]}
      />
    )

    expect(
      screen.getByText(`${t.shoes.kmOf(604, 1000)} · ${t.shoes.kmOf(53, 800)}`)
    ).toBeInTheDocument()
  })

  it('states one mileage per pair it counts', () => {
    const shoes = [
      shoe({ gearId: 'a', totalKm: 400, maxKm: 800, wearPercent: 50 }),
      shoe({ gearId: 'b', totalKm: 200, maxKm: 500, wearPercent: 40 }),
      shoe({ gearId: 'c', totalKm: 10, maxKm: 800, wearPercent: 1 }),
    ]
    render(<ProfileShoes shoes={shoes} />)

    expect(screen.getByText(t.profile.shoes.pairs(3))).toBeInTheDocument()
    expect(screen.getByText(/400 \/ 800 km · 200 \/ 500 km · 10 \/ 800 km/)).toBeInTheDocument()
  })

  it('still leads with the alert when a pair is past its watch threshold', () => {
    render(
      <ProfileShoes
        shoes={[
          shoe({ gearId: 'a', totalKm: 760, maxKm: 800, wearPercent: 95 }),
          shoe({ gearId: 'b', totalKm: 53, maxKm: 800, wearPercent: 7 }),
        ]}
      />
    )

    expect(screen.getByText(t.profile.shoes.needsReplacing(1))).toBeInTheDocument()
    expect(screen.queryByText(/760 \/ 800 km/)).not.toBeInTheDocument()
  })

  it('renders nothing when there are no pairs', () => {
    const { container } = render(<ProfileShoes shoes={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
