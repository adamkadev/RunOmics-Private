import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { t } from '@/i18n'
import { progressHubRows, type HubInput } from '../progressHub'
import { ProgressHub } from '../ProgressHub'

function shoe(overrides: Partial<ShoeStats>): ShoeStats {
  return {
    gearId: 'g', name: 'Shoe', brand: 'B', maxKm: 500, alertThresholdKm: 450, retired: false, totalKm: 100,
    sessionCount: 10, lastUsedDate: null, firstUsedDate: null, kmPerWeek: 10, wearPercent: 20, nearingLimit: false,
    ...overrides,
  }
}

const INPUT: HubInput = {
  latestRecord: { key: 'marathon', label: 'Marathon', seconds: 10_975, paceSecPerKm: 260, activityId: 'a', date: '2026-09-14', official: true },
  shoes: [shoe({ wearPercent: 100 }), shoe({ wearPercent: 95 }), shoe({ wearPercent: 30 }), shoe({ retired: true, wearPercent: 100 })],
  athlete: { lthrBpm: 172, thresholdPaceSecPerKm: 258 },
  latestVo2max: 50,
  goal: { goalYear: { year: 2026, annualDistanceKm: 1_200, targets: [] }, totalDistanceKm: 1_247, projection: null },
  nextRaceDate: '2026-10-16',
  heatmapDays: [
    { date: '2026-09-01', distanceKm: 10, sessionCount: 1, longRun: false },
    { date: '2026-09-02', distanceKm: 0, sessionCount: 0, longRun: false },
    { date: '2026-09-03', distanceKm: 8, sessionCount: 1, longRun: false },
  ],
  now: new Date(2026, 8, 25),
}

const YTD = { distanceKm: 1_247, durationSeconds: 367_200, sessionCount: 124, elevationGainM: 0, avgKmPerWeek: 0, calories: 0 }

describe('progressHubRows', () => {
  it('gives each sub-page one row with its live status, in order', () => {
    const rows = progressHubRows(INPUT)

    expect(rows.map((r) => r.href)).toEqual(['/records', '/shoes', '/athlete', '/goals', '/consistency', '/settings'])
    expect(rows[0]!.status).toContain('Marathon 3:02:55')
    expect(rows[2]!.status).toBe(`VO₂max 50 · LTHR 172 · ${t.profile.hub.threshold('4:18 /km')}`)
    expect(rows[4]!.status).toBe(t.profile.hub.activeDays(2))
    expect(rows[5]!.title).toBe(t.profile.hub.settings)
  })

  it('flags the shoes to replace, counting only active pairs', () => {
    const shoes = progressHubRows(INPUT)[1]!

    expect(shoes.status).toBe(t.profile.shoes.needsReplacing(2))
    expect(shoes.tone).toBe('warn')
  })
})

describe('ProgressHub', () => {
  it('leads with the year so far, then the rows', () => {
    render(<ProgressHub rows={progressHubRows(INPUT)} ytd={YTD} prevYear={{ ...YTD, distanceKm: 959, sessionCount: 97 }} year={2026} />)

    expect(screen.getByText(t.profile.hub.yearSoFar(2026))).toBeInTheDocument()
    expect(screen.getByText('+288')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(t.profile.hub.settings) })).toHaveAttribute('href', '/settings')
    expect(screen.getAllByRole('link')).toHaveLength(6)
  })
})
