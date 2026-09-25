import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RaceTimeCards, RACE_TIME_WINDOW_MONTHS } from '../RaceTimeCards'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import { MINUS } from '@/lib/formatters'
import { t } from '@/i18n'

const point = (date: string, pace5k: number) => ({ date, label: date, '5k': pace5k, '10k': null, half: null, marathon: null })

// 5K pace 4:30 three years ago, 4:00 a year ago, 3:50 now: 50 s over the whole
// history, but 10 s/km (50 s over 5 km) over the last 12 months.
const DATA: GarminRacePredictionsData = {
  points: [point('2023-09-20', 270), point('2025-09-20', 240), point('2026-09-20', 230)],
  distances: ['5k'],
  latest: { '5k': 1150 },
  latestDate: '2026-09-20',
}

describe('RaceTimeCards', () => {
  it('measures the change over the window its head names (G06)', () => {
    render(<RaceTimeCards data={DATA} />)
    expect(screen.getByText(t.analytics.raceTimes.trend(RACE_TIME_WINDOW_MONTHS))).toBeTruthy()
    expect(screen.getByText(`${MINUS}0:50`)).toBeTruthy()
  })
})
