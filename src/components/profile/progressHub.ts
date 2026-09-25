import type { RecordEntry } from '@/domain/race/records'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'
import type { ProfileGoal } from '@/application/usecases/GetProfileData'
import { wearStatus } from '@/domain/shoe/wearStatus'
import { isRecentRecord } from '@/domain/ai/celebrationWindow'
import { formatDate, formatDuration, formatKm, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

export interface HubRow {
  key: 'records' | 'shoes' | 'athlete' | 'goals' | 'consistency' | 'settings'
  href: string
  title: string
  status: string | null
  tone?: 'warn'
}

export interface HubInput {
  latestRecord: RecordEntry | null
  shoes: ShoeStats[]
  athlete: { lthrBpm?: number | null; thresholdPaceSecPerKm?: number | null }
  latestVo2max: number | null
  goal: ProfileGoal | null
  nextRaceDate: string | null
  heatmapDays: HeatmapDay[]
  now: Date
}

/**
 * Progress's rows and the live status line each carries. The page used to
 * repeat Athlete's VO₂max, VMA, LTHR and zones, bury Settings behind a gear
 * and put the 10K goal two taps deep; each sub-page is one row now.
 */
export function progressHubRows(input: HubInput): HubRow[] {
  const h = t.profile.hub
  const record = input.latestRecord
  const active = input.shoes.filter((shoe) => !shoe.retired)
  const worn = active.filter((shoe) => wearStatus(shoe.wearPercent) === 'replace').length
  const athlete = [
    input.latestVo2max !== null ? `VO₂max ${Math.round(input.latestVo2max)}` : null,
    input.athlete.lthrBpm ? `LTHR ${input.athlete.lthrBpm}` : null,
    input.athlete.thresholdPaceSecPerKm ? h.threshold(formatPace(input.athlete.thresholdPaceSecPerKm)) : null,
  ].filter(Boolean)
  const goal = input.goal
  const goalLine = [
    goal && goal.goalYear.annualDistanceKm > 0
      ? h.annual(formatKm(goal.totalDistanceKm), formatKm(goal.goalYear.annualDistanceKm))
      : null,
    input.nextRaceDate ? h.nextRace(formatDate(input.nextRaceDate, { style: 'bare' })) : null,
  ].filter(Boolean)
  const activeDays = input.heatmapDays.filter((day) => day.sessionCount > 0).length

  return [
    {
      key: 'records',
      href: '/records',
      title: h.records,
      status: record && record.seconds !== null && record.date
        ? h.recordLine(record.label, formatDuration(record.seconds), formatDate(record.date, { style: 'bare' }), isRecentRecord(record.date, input.now))
        : h.noRecords,
    },
    {
      key: 'shoes',
      href: '/shoes',
      title: h.shoes,
      status: worn > 0 ? t.profile.shoes.needsReplacing(worn) : t.profile.shoes.pairs(active.length),
      ...(worn > 0 ? { tone: 'warn' as const } : {}),
    },
    { key: 'athlete', href: '/athlete', title: h.athlete, status: athlete.length ? athlete.join(' · ') : null },
    { key: 'goals', href: '/goals', title: h.goals, status: goalLine.length ? goalLine.join(' · ') : h.noGoal },
    { key: 'consistency', href: '/consistency', title: h.consistency, status: h.activeDays(activeDays) },
    { key: 'settings', href: '/settings', title: h.settings, status: h.settingsLine },
  ]
}
