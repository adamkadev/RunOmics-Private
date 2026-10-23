import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { macrocyclePhaseRanges, macrocycleStart } from '@/components/coaching/presentation'
import { shortDist } from '@/components/goals/shortDistance'
import { DAY_MS, addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { t } from '@/i18n'
import type { PlanCoachingView } from './planCoachingView'
import { daysUntil, raceTitle, type PlanRace } from './planRace'

export interface PhaseSpan {
  key: string
  name: string
  shortName: string
  startDate: string
  endDate: string
}

const mondayOf = (date: string) => isoDate(startOfWeek(new Date(`${date}T00:00:00`)))
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

function rangeSpans(ranges: PlanPhaseRange[]): PhaseSpan[] {
  return ranges.map((r) => ({
    key: `${r.phase}:${r.startDate}`,
    name: t.plan.weekPurpose.planPhase[r.phase],
    shortName: t.plan.weekPurpose.planPhase[r.phase],
    startDate: r.startDate,
    endDate: r.endDate,
  }))
}

export function planPhaseSpans(coaching: PlanCoachingView | null, garminRanges: PlanPhaseRange[]): PhaseSpan[] {
  if (coaching) {
    const ranges = macrocyclePhaseRanges(coaching.plan)
    if (ranges.length > 0) return rangeSpans(ranges)
    if (!coaching.plan.targetEvent) {
      return [{
        key: 'general',
        name: t.plan.weekPurpose.generalPreparation,
        shortName: t.plan.phase.generalShort,
        startDate: mondayOf(macrocycleStart(coaching.plan)),
        endDate: coaching.plan.block.endDate,
      }]
    }
  }
  return rangeSpans(garminRanges)
}

export function spanWeeks(span: Pick<PhaseSpan, 'startDate' | 'endDate'>): number {
  return Math.max(1, Math.round((daysBetween(span.startDate, span.endDate) + 1) / 7))
}

export function spanOfWeek(spans: PhaseSpan[], monday: string): PhaseSpan | null {
  let best: PhaseSpan | null = null
  let bestDays = 0
  for (const span of spans) {
    let days = 0
    for (let i = 0; i < 7; i++) {
      const date = isoDate(addDays(new Date(`${monday}T00:00:00`), i))
      if (span.startDate <= date && date <= span.endDate) days += 1
    }
    if (days > 0 && days >= bestDays) {
      best = span
      bestDays = days
    }
  }
  return best
}

export interface PhaseWeek {
  span: PhaseSpan
  week: number
  total: number
}

export function phaseWeek(spans: PhaseSpan[], monday: string): PhaseWeek | null {
  const span = spanOfWeek(spans, monday)
  if (!span) return null
  const total = spanWeeks(span)
  const week = Math.floor(daysBetween(mondayOf(span.startDate), monday) / 7) + 1
  return { span, week: Math.min(Math.max(week, 1), total), total }
}

export function raceCountdown(race: PlanRace, today: string): string | null {
  const days = daysUntil(race.date, today)
  if (days < 0) return null
  const name = shortDist(race.distance) || raceTitle(race)
  return days < 7 ? t.plan.phase.raceInDays(name, days) : t.plan.phase.raceInWeeks(name, Math.round(days / 7))
}
