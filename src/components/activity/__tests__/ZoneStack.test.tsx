import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ZoneBar } from '../ZoneBar'
import { t } from '@/i18n'

const zone = (z: number, percent: number) => ({ zone: z, seconds: percent * 10, percent, minBpm: 0, maxBpm: null })

describe('ZoneBar', () => {
  // R3: one stacked bar with the zone the run spent most time in.
  it('draws one stacked bar of the zones used, and names the top one', () => {
    render(<ZoneBar hrZones={[zone(1, 5), zone(2, 15), zone(3, 30), zone(4, 35), zone(5, 15)]} />)

    expect(screen.getByText(t.activity.zones.title)).toBeInTheDocument()
    expect(screen.getByText(t.activity.zones.mostIn(4, 35))).toBeInTheDocument()
    expect(screen.getByTestId('zone-stack').children).toHaveLength(5)
  })

  it('leaves unused zones out of the bar', () => {
    render(<ZoneBar hrZones={[zone(1, 0), zone(2, 60), zone(3, 40)]} />)
    expect(screen.getByTestId('zone-stack').children).toHaveLength(2)
  })
})
