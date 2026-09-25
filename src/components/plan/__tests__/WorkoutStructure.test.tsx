import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WorkoutStep } from '@/domain/activity/types'
import { t } from '@/i18n'
import { SessionStructureBar, WorkoutStructureBars, recoveryLabel } from '../WorkoutStructure'

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

describe('the structure bar', () => {
  it('stays a decoration until it is asked to carry labels', () => {
    const { container, rerender } = render(<WorkoutStructureBars steps={INTERVALS} />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.textContent).toBe('')

    rerender(<WorkoutStructureBars steps={INTERVALS} labels />)
    expect(container.firstElementChild).not.toHaveAttribute('aria-hidden')
    expect(container.textContent).not.toBe('')
  })

  it('labels the effort blocks and nothing else', () => {
    render(<WorkoutStructureBars steps={INTERVALS} labels />)

    expect(screen.getAllByText(t.plan.structure.min(8))).toHaveLength(3)
    expect(screen.queryByText(t.plan.structure.min(15))).not.toBeInTheDocument()
    expect(screen.queryByText(t.plan.structure.min(2))).not.toBeInTheDocument()
    expect(screen.queryByText(t.plan.structure.min(10))).not.toBeInTheDocument()
  })

  it('leaves a block too narrow to hold text unlabelled', () => {
    const reps = Array.from({ length: 10 }, (_, i) => [
      { kind: 'effort' as const, minutes: 1, rep: i + 1 },
      { kind: 'recovery' as const, minutes: 1, rep: i + 1 },
    ]).flat()
    render(
      <WorkoutStructureBars
        steps={[{ kind: 'warmup', minutes: 15 }, ...reps, { kind: 'cooldown', minutes: 10 }]}
        labels
      />
    )

    expect(screen.queryByText(t.plan.structure.min(1))).not.toBeInTheDocument()
  })
})

describe('the recovery figure the bar cannot spell out', () => {
  it('reads the between-reps recovery off the steps', () => {
    expect(recoveryLabel(INTERVALS)).toBe(t.plan.structure.rec(2))
  })

  it('offers nothing for a session with no recovery at all', () => {
    expect(recoveryLabel([{ kind: 'effort', minutes: 40 }])).toBeNull()
    expect(recoveryLabel(null)).toBeNull()
  })
})

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
