import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WorkoutStep } from '@/domain/activity/types'
import { t } from '@/i18n'
import { SessionStructureBar, tileCaption, tileSegments } from '../WorkoutStructure'

const INTERVALS: WorkoutStep[] = [
  { kind: 'warmup', minutes: 15 },
  { kind: 'effort', minutes: 8, rep: 1 },
  { kind: 'recovery', minutes: 2, rep: 1 },
  { kind: 'effort', minutes: 8, rep: 2 },
  { kind: 'recovery', minutes: 2, rep: 2 },
  { kind: 'effort', minutes: 8, rep: 3 },
  { kind: 'recovery', minutes: 2, rep: 3 },
  { kind: 'cooldown', minutes: 10 },
]

describe('the session structure bar', () => {
  // "25 min · Z4 continuous" was navy on mid-blue, about 3:1, and the blue said
  // Z2 on a Z4 session.
  it('fills a continuous session in its zone and writes it in zone ink', () => {
    render(<SessionStructureBar steps={[]} zoneWord="Z4" zone={4} totalSeconds={1_500} />)
    const label = screen.getByText(/Z4/)

    expect(label.style.color).toBe('var(--zone-ink)')
    expect((label.parentElement as HTMLElement).style.background).toBe('var(--zone-4)')
  })

  it('draws the reps of an interval session in its zone too', () => {
    const { container } = render(<SessionStructureBar steps={INTERVALS} zoneWord="Z4" zone={4} totalSeconds={3_000} />)
    const fills = [...container.querySelectorAll<HTMLElement>('[style*="flex-grow"]')].map((el) => el.style.background)

    expect(fills.filter((f) => f === 'var(--zone-4)')).toHaveLength(3)
  })
})

// Design review, Oct 2026 (mock 1a): Today's tile draws the session as it
// runs, 12 pt tall, and says under it what it draws.
describe("Today's session bar", () => {
  // Oct 8 as the plan writes it: 9 km easy, about 54 minutes, then six strides.
  const STRIDES: WorkoutStep[] = [
    { kind: 'effort', minutes: 54, seconds: 3_213, paceSecPerKm: [330, 384] },
    ...Array.from({ length: 6 }, (_, i) => [
      { kind: 'effort' as const, minutes: 1, seconds: 20, rep: i + 1, paceSecPerKm: [215, 230] as [number, number] },
      { kind: 'recovery' as const, minutes: 1, seconds: 60, rep: i + 1 },
    ]).flat(),
  ]
  // Oct 6: 3 × 7:40 with 4:00 easy between, warm-up and cool-down.
  const THRESHOLD: WorkoutStep[] = [
    { kind: 'warmup', minutes: 12, seconds: 714 },
    ...Array.from({ length: 3 }, (_, i) => [
      { kind: 'effort' as const, minutes: 8, seconds: 460, rep: i + 1 },
      { kind: 'recovery' as const, minutes: 4, seconds: 240, rep: i + 1 },
    ]).flat(),
    { kind: 'cooldown', minutes: 10, seconds: 571 },
  ]

  const segments = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLElement>('[data-testid="tile-structure"] [aria-hidden] > span')].map((el) => ({ grow: Number(el.style.flexGrow), fill: el.style.background }))

  it('is one block in the zone for a continuous run, and says so', () => {
    const { container } = render(<SessionStructureBar variant="tile" steps={[]} zoneWord="Z2" zone={2} totalSeconds={3_540} />)

    expect(segments(container)).toEqual([{ grow: 1, fill: 'var(--zone-2)' }])
    expect(container.querySelector('[data-testid="tile-structure"] [aria-hidden]')!.className).toContain('h-3')
    expect(container.textContent).toBe(`59 min · Z2 ${t.plan.continuous}`)
  })

  it('draws an easy run in its zone and each stride, with its jog, as a sliver of Z5', () => {
    const { container } = render(<SessionStructureBar variant="tile" steps={STRIDES} zoneWord="Z2" zone={2} totalSeconds={3_693} />)

    expect(segments(container)).toEqual([
      { grow: 3_213, fill: 'var(--zone-2)' },
      ...Array.from({ length: 6 }, () => ({ grow: 80, fill: 'var(--zone-5)' })),
    ])
    expect(screen.getByText('54 min · Z2')).toBeInTheDocument()
    expect(screen.getByText(t.plan.structure.strides(6, t.plan.session.seconds(20)))).toBeInTheDocument()
  })

  it('draws reps in the session zone with their recoveries, and none that ends the session', () => {
    const { container } = render(<SessionStructureBar variant="tile" steps={THRESHOLD} zoneWord="Z4" zone={4} totalSeconds={3_625} />)
    const drawn = segments(container)

    expect(drawn.map((segment) => segment.grow)).toEqual([714, 460, 240, 460, 240, 460, 240, 571])
    expect(drawn.filter((segment) => segment.fill === 'var(--zone-4)')).toHaveLength(3)
    expect(screen.getByText('3 × 7:40 · Z4')).toBeInTheDocument()
    expect(screen.getByText(t.plan.row.recovery('4:00'))).toBeInTheDocument()

    // No cool-down after the last jog: the session ends on the last rep.
    expect(tileSegments(THRESHOLD.slice(0, -1), 4).map((segment) => segment.weight)).toEqual([714, 460, 240, 460, 240, 460])
  })

  it('reads the plan the same with no length to go on', () => {
    expect(tileCaption([], null, 0)).toEqual({ left: null, right: null })
    expect(tileSegments([], null)).toEqual([{ weight: 1, fill: 'var(--zone-2)' }])
  })
})
