import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MilestonesTimeline } from '../MilestonesTimeline'
import { milestoneDotClass } from '../milestoneVisuals'
import type { Milestone } from '@/application/usecases/GetMilestones'
import { t } from '@/i18n'

const MILESTONES: Milestone[] = [
  { type: 'distance-tier', date: '2026-01-11', label: '1,000 km', detail: 'lifetime' },
  { type: 'streak', date: '2026-03-02', label: '10 week streak', detail: 'ten weeks running' },
  { type: 'record', date: '2026-07-31', label: '5K record', detail: '20:24' },
  { type: 'first-activity', date: '2025-04-02', label: 'First run', detail: '3.1 km' },
] as Milestone[]

describe('MilestonesTimeline', () => {
  it('renders every milestone of a year, none of them clipped into a carousel', () => {
    const { container } = render(<MilestonesTimeline milestones={MILESTONES} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(MILESTONES.length)
    expect(container.querySelectorAll('.overflow-x-auto')).toHaveLength(0)
    expect(container.querySelectorAll('.snap-x')).toHaveLength(0)
  })

  it('groups by year and lets the heading do the grouping', () => {
    render(<MilestonesTimeline milestones={MILESTONES} />)

    expect(screen.getByRole('heading', { name: '2026' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2025' })).toBeInTheDocument()
    expect(screen.getAllByRole('list')).toHaveLength(2)
  })

  it('has nothing to show without milestones', () => {
    const { container } = render(<MilestonesTimeline milestones={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  // Design review, Oct 2026: a gold dot on some rows, and nothing said what it meant.
  it('keys the record dot once, on the first year\'s line, in the dot\'s own gold', () => {
    render(<MilestonesTimeline milestones={MILESTONES} />)

    const keys = screen.getAllByTestId('milestone-key')
    expect(keys).toHaveLength(1)
    expect(keys[0]!.textContent).toBe(t.records.milestones.recordKey)
    expect(keys[0]!.querySelector('span')!.className).toContain(milestoneDotClass('record')!)
    expect(screen.getByRole('heading', { name: '2026' }).parentElement!.contains(keys[0]!)).toBe(true)
  })

  it('has no key when no row carries the mark', () => {
    render(<MilestonesTimeline milestones={MILESTONES.filter((m) => m.type !== 'record')} />)
    expect(screen.queryByTestId('milestone-key')).toBeNull()
  })
})
