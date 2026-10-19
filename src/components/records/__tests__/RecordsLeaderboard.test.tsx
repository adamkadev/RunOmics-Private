import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { RecordsLeaderboard } from '../RecordsLeaderboard'
import type { RecordEntry, TopEfforts } from '@/application/usecases/GetRecords'
import type { RacePrediction } from '@/application/usecases/GetRacePredictions'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

const record = (key: string, label: string, seconds: number, official = false): RecordEntry => ({
  key,
  label,
  seconds,
  paceSecPerKm: null,
  activityId: `${key}-0`,
  date: '2026-06-16',
  official,
})

const prediction = (key: string, predictedSeconds: number) =>
  ({ key, predictedSeconds }) as RacePrediction

const efforts = (key: string, times: number[]) =>
  times.map((seconds, i) => ({ seconds, distanceKm: 1, activityId: `${key}-${i}`, date: '2026-06-16', eventName: `Run ${i}` }))

const RECORDS = [record('1k', '1K', 211), record('1mile', '1 Mile', 345), record('5k', '5K', 1242, true)]
const TOP: TopEfforts = {
  '1k': efforts('1k', [211, 214, 214, 215, 225, 230, 240]),
  '1mile': efforts('1mile', [345]),
}
const PREDICTIONS = [prediction('1k', 206), prediction('1mile', 345), prediction('5k', 1222)]

describe('RecordsLeaderboard', () => {
  it('heads the columns and gives each distance its best, its prediction and the gap', () => {
    render(<RecordsLeaderboard records={RECORDS} topEfforts={TOP} predictions={PREDICTIONS} />)

    expect(screen.getByText(t.records.cols.predicted)).toBeInTheDocument()
    const gaps = screen.getAllByTestId('prediction-gap')
    expect(gaps.map((g) => g.textContent)).toEqual([
      t.records.faster(t.records.gapSeconds(5)),
      t.records.atPotential,
      t.records.faster(t.records.gapSeconds(20)),
    ])
    expect(gaps[0]!.className).toContain('text-accent-text')
    expect(gaps[1]!.className).toContain('text-muted-foreground')
    expect(screen.getByText(t.records.raceTag)).toBeInTheDocument()
  })

  it('opens a distance with more than one effort into its top five, medalled and linked', () => {
    render(<RecordsLeaderboard records={RECORDS} topEfforts={TOP} predictions={PREDICTIONS} />)

    // One effort only: nothing to open.
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    const list = screen.getByTestId('effort-list')
    const links = within(list).getAllByRole('link')
    expect(links).toHaveLength(5)
    expect(links[0]).toHaveAttribute('href', '/activities/1k-0')
    const ranks = within(list).getAllByTestId('effort-rank')
    expect(ranks[0]!.className).toContain(STATUS.gold.dot)
    expect(ranks[2]!.className).toContain(STATUS.bronze.dot)
    expect(ranks[3]!.className).toContain('var(--track)')
    expect(links[1]!.textContent).toContain(`+${t.records.gapSeconds(3)}`)

    fireEvent.click(within(list).getByRole('button', { name: t.records.allEfforts('1K') }))
    expect(within(list).getAllByRole('link')).toHaveLength(7)
  })
})
