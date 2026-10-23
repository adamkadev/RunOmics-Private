import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MilestonesTimeline, NextUpCard } from '../MilestonesTimeline'
import { milestoneIcon } from '../milestoneVisuals'
import type { Milestone, NextMilestone } from '@/application/usecases/GetMilestones'
import { t } from '@/i18n'

const MILESTONES: Milestone[] = [
  { type: 'distance-tier', date: '2026-10-08', label: '1,500 km this year', detail: '2026' },
  { type: 'activity-count', date: '2026-09-29', label: '300th run', detail: '2,542 km lifetime' },
  { type: 'record', date: '2026-06-16', label: '1K record', detail: '3:31' },
  { type: 'activity-count', date: '2026-06-17', label: '250th run', detail: '2,115 km lifetime' },
  { type: 'first-activity', date: '2025-04-02', label: 'First run', detail: '3.1 km' },
] as Milestone[]

const TODAY = '2026-10-19'

describe('MilestonesTimeline', () => {
  it('renders every milestone, none of them clipped into a carousel', () => {
    const { container } = render(<MilestonesTimeline milestones={MILESTONES} today={TODAY} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(MILESTONES.length)
    expect(container.querySelectorAll('.overflow-x-auto')).toHaveLength(0)
  })

  it('groups by month, naming the year only outside this one', () => {
    render(<MilestonesTimeline milestones={MILESTONES} today={TODAY} />)

    const headings = screen.getAllByRole('heading').map((h) => h.textContent)
    expect(headings).toEqual(['October', 'September', 'June', 'April 2025'])
    expect(screen.getAllByRole('list')).toHaveLength(4)
  })

  it('has nothing to show without milestones', () => {
    const { container } = render(<MilestonesTimeline milestones={[]} today={TODAY} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('marks each row with its type\'s icon', () => {
    render(<MilestonesTimeline milestones={MILESTONES} today={TODAY} />)
    const icons = screen.getAllByTestId('milestone-icon')
    expect(icons[0]!.className).toContain(milestoneIcon('distance-tier').className)
    expect(icons[1]!.className).toContain(milestoneIcon('activity-count').className)
    expect(icons[2]!.className).toContain(milestoneIcon('record').className)
  })
})

describe('NextUpCard', () => {
  const NEXT: NextMilestone[] = [
    { kind: 'activity-count', label: '350th run', remaining: 35, progress: 0.9 },
    { kind: 'distance-tier', label: '2,000 km this year', remaining: 432, progress: 0.784 },
  ]

  it('shows each next milestone with what is left and a bar for how far along', () => {
    render(<NextUpCard next={NEXT} />)

    expect(screen.getByText(t.records.milestones.nextUp)).toBeInTheDocument()
    expect(screen.getByText(t.records.milestones.toGo('35'))).toBeInTheDocument()
    expect(screen.getByText(t.records.milestones.toGo('432'))).toBeInTheDocument()
    const bars = screen.getAllByRole('progressbar')
    expect(bars.map((b) => b.getAttribute('aria-valuenow'))).toEqual(['90', '78'])
    expect((bars[0]!.firstElementChild as HTMLElement).style.width).toBe('90%')
  })

  it('has nothing to show past the last tiers', () => {
    const { container } = render(<NextUpCard next={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
