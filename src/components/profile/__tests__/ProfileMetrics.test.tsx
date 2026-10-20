import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AthleteStats } from '@/components/profile/ProfileAthleteStats'
import { ProfileHrZones, windowTotalLabel, zoneSegments } from '@/components/profile/ProfileHrZones'
import { t } from '@/i18n'

const z = t.profile.trainingZones
const a = t.settings.athlete

describe('capability-driven athlete metrics', () => {
  it('shows configured HR zones without fabricating an LTHR value', () => {
    render(
      <ProfileHrZones
        athlete={{ hrZoneBoundsBpm: [100, 120, 140, 160, 180] }}
        weeklyZoneTime={[]}
        recentZoneTime={[]}
      />
    )

    expect(screen.getByText('100–119')).toBeInTheDocument()
    expect(screen.queryByText(/170/)).not.toBeInTheDocument()
  })

  it('derives zone boundaries from a real LTHR', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={[]} />)
    // Z4 starts at 95% of LTHR, Z5 at LTHR itself.
    expect(within(screen.getByTestId('zone-row-5')).getByText('≥ 172')).toBeInTheDocument()
    expect(within(screen.getByTestId('zone-row-4')).getByText('163–171')).toBeInTheDocument()
  })

  // Design review, Oct 2026: one order everywhere, Z1 to Z5 top to bottom.
  it('lists the zones Z1 first, as the bar above them reads', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={[]} />)
    const rows = [...document.querySelectorAll('[data-testid^="zone-row-"]')].map((row) => row.getAttribute('data-testid'))
    expect(rows).toEqual(['zone-row-1', 'zone-row-2', 'zone-row-3', 'zone-row-4', 'zone-row-5'])
  })

  it('omits an unavailable threshold pace instead of rendering a placeholder', () => {
    render(<AthleteStats athlete={{ vmaKmh: 15.2 }} />)

    expect(screen.getByText(a.vma)).toBeInTheDocument()
    expect(screen.queryByText(a.thresholdPace)).not.toBeInTheDocument()
    expect(screen.queryByText(t.profile.athlete.notSet)).not.toBeInTheDocument()
  })

  // 3.0 1j: one card, two rows of three - the heart, then pace, VMA and
  // fitness age - every HR Garmin's own, so nothing says estimated.
  it('shows the heart row, then threshold pace, VMA and fitness age, in one card of three columns', () => {
    render(
      <AthleteStats
        athlete={{ restingHrBpm: 45, lthrBpm: 179, maxHrBpm: 200, vmaKmh: 16.3, thresholdPaceSecPerKm: 261, fitnessAgeYrs: 18.2, age: 29 }}
      />
    )

    const cells = screen.getAllByTestId('athlete-stat')
    expect(cells.map((cell) => cell.firstElementChild?.textContent)).toEqual([
      a.restingHr, a.thresholdHr, a.maxHr, a.thresholdPace, a.vma, a.fitnessAge,
    ])
    expect(cells.map((cell) => cell.lastElementChild?.textContent)).toEqual([
      `45${t.units.bpm}`, `179${t.units.bpm}`, `200${t.units.bpm}`, `4:21${t.units.perKm}`, `16.3${t.units.kmh}`, `18${a.ofAge(29)}`,
    ])
    expect(a.ofAge(29)).toBe('vs 29')
    const card = screen.getByTestId('athlete-stats')
    expect(card.className).toContain('grid-cols-3')
    expect(card.textContent).not.toMatch(/estimated|zones\)/i)
    expect(screen.queryByText(a.vo2max)).not.toBeInTheDocument()
    // Design review, Oct 2026: no definitions behind the labels.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('draws a line between the rows and between the cells of each', () => {
    render(<AthleteStats athlete={{ restingHrBpm: 45, lthrBpm: 179, maxHrBpm: 200, vmaKmh: 16.3, thresholdPaceSecPerKm: 261, fitnessAgeYrs: 18 }} />)
    const cells = screen.getAllByTestId('athlete-stat')
    expect(cells.map((cell) => cell.className.includes('border-l'))).toEqual([false, true, true, false, true, true])
    expect(cells.map((cell) => cell.className.includes('border-t'))).toEqual([false, false, false, true, true, true])
  })
})

describe('ProfileHrZones table', () => {
  const week = [
    { zone: 4, seconds: 9 * 60, percent: 0 },
    { zone: 5, seconds: 5 * 60, percent: 0 },
  ]
  const recent = [{ zone: 2, seconds: 125 * 60, percent: 0 }]

  it('labels Pace, HR and Time as their own columns', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={week} recentZoneTime={recent} />)
    const header = screen.getByTestId('zone-columns')
    for (const column of [z.columnZone, z.columnPace, z.columnHr, z.columnTime]) {
      expect(within(header).getByText(column)).toBeInTheDocument()
    }
  })

  // 3.0 1j: four weeks first, whatever the week holds, and no line to say so.
  it('opens on 4 weeks, even with time this week', () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={week} recentZoneTime={recent} />)
    expect(screen.getByRole('tab', { name: z.fourWeeksSpoken })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('zone-total').textContent).toBe(z.totalLine(`2 ${t.units.hour} 5 ${t.units.min}`))
    expect(screen.queryByText(/no sessions yet/i)).toBeNull()
  })

  // v4.17: time is "9 min" under an hour, "2 h 05" over. The week under way
  // is not a week's split yet: no verdict colour.
  it('writes time with its units, and reads the week under way without a verdict colour', async () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={week} recentZoneTime={recent} />)
    await userEvent.click(screen.getByRole('tab', { name: z.weekSpoken }))
    expect(within(screen.getByTestId('zone-row-4')).getByText(`9 ${t.units.min}`)).toBeInTheDocument()
    expect(screen.getByTestId('zone-total').textContent).toBe(z.totalLine(`14 ${t.units.min}`))
    expect(screen.getByTestId('zone-hard-share').textContent).toBe(`${z.hard('100%')} · ${z.soFar}`)
    expect(screen.getByTestId('zone-verdict').className).toContain('text-muted-foreground')
    const stack = screen.getByTestId('zone-stack')
    expect([...stack.querySelectorAll('[data-zone]')].map((el) => el.getAttribute('data-zone'))).toEqual(['4', '5'])
  })

  // Design review, Oct 2026: "Hard 7 %" read amber here against a 10-15 %
  // target while Analytics > Intensity read the same weeks "In range". One
  // split and one verdict now, and too little hard is never a caution.
  // 3.0 1j: it is the headline, "Hard 7% · in range", the verdict in pos.
  it('heads four weeks with the hard share and the verdict Analytics gives the same time', () => {
    const inRange = [
      { zone: 2, seconds: 93 * 60, percent: 0 },
      { zone: 4, seconds: 7 * 60, percent: 0 },
    ]
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={inRange} />)
    expect(screen.getByTestId('zone-hard-share').textContent).toBe(`${z.hard('7%')} · ${z.verdict.inRange}`)
    expect(screen.getByTestId('zone-verdict').className).toContain('text-[var(--pos)]')
    expect(screen.getByTestId('zone-total').textContent).toBe(z.totalLine(`1 ${t.units.hour} 40 ${t.units.min}`))
  })

  it('reads too much hard over four weeks as a caution', () => {
    const tooHard = [
      { zone: 2, seconds: 60 * 60, percent: 0 },
      { zone: 4, seconds: 40 * 60, percent: 0 },
    ]
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={tooHard} />)
    expect(screen.getByTestId('zone-hard-share').textContent).toBe(`${z.hard('40%')} · ${z.verdict.tooHard}`)
    expect(screen.getByTestId('zone-verdict').className).toContain('text-[var(--warn)]')
  })

  // 3.0 1j: every zone with time draws, at least 3 % wide, its share under it.
  it('draws each zone with time as wide as its share, at least 3 %, with its share under it', () => {
    const withSliver = [
      { zone: 1, seconds: 26 * 60, percent: 0 },
      { zone: 2, seconds: 61 * 60, percent: 0 },
      { zone: 3, seconds: 8 * 60, percent: 0 },
      { zone: 4, seconds: 4.6 * 60, percent: 0 },
      { zone: 5, seconds: 0.4 * 60, percent: 0 },
    ]
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={withSliver} />)
    const stack = screen.getByTestId('zone-stack')
    expect([...stack.querySelectorAll('[data-zone]')].map((el) => el.getAttribute('data-zone'))).toEqual(['1', '2', '3', '4', '5'])
    expect(screen.getAllByTestId('zone-pct').map((el) => el.textContent)).toEqual(['26%', '61%', '8%', '5%', '1%'])
  })

  it('has a single Week / 4 weeks toggle that switches the whole table', async () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={week} recentZoneTime={recent} />)
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    expect(within(screen.getByTestId('zone-row-2')).getByText(`2 ${t.units.hour} 05`)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: z.weekSpoken }))
    expect(within(screen.getByTestId('zone-row-2')).getByText(`0 ${t.units.min}`)).toBeInTheDocument()
    expect(within(screen.getByTestId('zone-row-4')).getByText(`9 ${t.units.min}`)).toBeInTheDocument()
  })

  it('says an empty week is empty, with no bar and no headline', async () => {
    render(<ProfileHrZones athlete={{ lthrBpm: 172 }} weeklyZoneTime={[]} recentZoneTime={recent} />)
    await userEvent.click(screen.getByRole('tab', { name: z.weekSpoken }))
    expect(screen.getByText(z.noSessionsThisWeek)).toBeInTheDocument()
    expect(screen.queryByTestId('zone-stack')).toBeNull()
    expect(screen.queryByTestId('zone-hard-share')).toBeNull()
  })
})

describe('zoneSegments', () => {
  it('floors a sliver at 3 % wide and labels it at least 1 %, and leaves an empty zone out', () => {
    const segments = zoneSegments([
      { zone: 2, seconds: 997, percent: 0 },
      { zone: 5, seconds: 3, percent: 0 },
    ])
    expect(segments).toEqual([
      { zone: 2, pct: 100, flex: 99.7 },
      { zone: 5, pct: 1, flex: 3 },
    ])
    expect(zoneSegments([])).toEqual([])
  })

  it('writes the window total in hours and minutes', () => {
    expect(windowTotalLabel(19 * 3600 + 11 * 60)).toBe(`19 ${t.units.hour} 11 ${t.units.min}`)
    expect(windowTotalLabel(42 * 60)).toBe(`42 ${t.units.min}`)
  })
})
