import type { Activity } from '@/domain/activity/types'
import type { CoachingPlan, TrainingWeek } from '@/domain/coaching/types'
import type { CheckIn, NiggleEpisode } from '@/domain/wellness/checkIn'
import { DAY_MS } from '@/lib/calendarDate'
import type { TrainingBreak } from '@/infrastructure/repositories/JsonAthleteRepository'
import { blocksMeters, planEasyPace } from '@/domain/coaching/sessionDistance'
import { controlledStep } from './autoregulation'
import { CONTROLLED_THRESHOLD, type FullWeekGrowth, type GrowthHoldReason } from './controlledThreshold'
import { fullWeekLimits, longSessionLimitKm, weekKm, type VolumeBand } from './volume'

export interface BlockGrowthInput {
  /** The block being renewed. */
  plan: CoachingPlan | null
  runs: Activity[]
  referenceDate: string
  /** Undefined when the check-ins could not be read, which is not the same as none written. */
  checkIns?: ({ date: string } & CheckIn)[]
  niggles?: NiggleEpisode[]
  breaks?: TrainingBreak[]
  returning: boolean
  fatigueFlagged: boolean
  band: VolumeBand
}

export interface BlockGrowth {
  growth: FullWeekGrowth
  /** The most the full week may carry without a validator refusing it. */
  maxWeekKm: number
}

const day = (date: string) => Math.floor(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY_MS)
const isoDay = (days: number) => new Date(days * DAY_MS).toISOString().slice(0, 10)
const tenth = (km: number) => Math.round(km * 10) / 10

function controlledMinutes(week: TrainingWeek): { sessions: number; minutes: number } {
  const steps = week.workouts.map(controlledStep).filter((step) => step !== null)
  const seconds = steps.reduce((sum, { repetitions, step }) => sum + repetitions * step.target.durationSeconds!, 0)
  return { sessions: steps.length, minutes: seconds / 60 }
}

/** The heaviest week that held the whole dose; a lighter week or one still building toward it is not the level. */
function previousFullWeek(plan: CoachingPlan): { km: number; longestKm: number } | null {
  const { fullWeek, blockGrowth } = CONTROLLED_THRESHOLD
  const fullMinutes = fullWeek.sessions * fullWeek.sessionMinutes * blockGrowth.fullDoseShare
  let best: { km: number; longestKm: number } | null = null
  for (const week of plan.weeks) {
    const running = { ...week, workouts: week.workouts.filter((workout) => workout.status !== 'cancelled') }
    const dose = controlledMinutes(running)
    if (dose.sessions < fullWeek.sessions || dose.minutes < fullMinutes) continue
    const easyPace = planEasyPace(running.workouts)
    const km = weekKm(running, easyPace)
    if (best && km <= best.km) continue
    const longestKm = Math.max(...running.workouts.map((workout) => blocksMeters(workout.blocks, easyPace) / 1_000))
    best = { km: tenth(km), longestKm: tenth(longestKm) }
  }
  return best
}

function longestGap(runs: Activity[], from: number, to: number): { days: number; after: number } {
  const days = [...new Set(runs.map((run) => day(run.date)).filter((date) => date >= from && date <= to))].sort((a, b) => a - b)
  let gap = { days: 0, after: from - 1 }
  let previous = from - 1
  for (const date of [...days, to + 1]) {
    if (date - previous - 1 > gap.days) gap = { days: date - previous - 1, after: previous }
    previous = date
  }
  return gap
}

/** A break, in the order the athlete's own account outranks what the runs and the readings infer. */
function breakInBlock(input: BlockGrowthInput, start: number, end: number): { reason: GrowthHoldReason; detail: string } | null {
  const rules = CONTROLLED_THRESHOLD.blockGrowth
  if (input.returning) return { reason: 'returning', detail: 'the athlete is returning to running after a long break' }
  if (end - start + 1 < rules.minBlockDays) {
    return { reason: 'short_block', detail: `the block ran from ${isoDay(start)} for ${end - start + 1} days, too few to count as completed` }
  }
  const stop = (input.breaks ?? []).find((pause) => day(pause.end) >= start && day(pause.start) <= end
    && (pause.reason === 'injury' || pause.reason === 'illness' || pause.reason === 'pregnancy'))
  if (stop) {
    return { reason: stop.reason === 'injury' ? 'injury' : 'illness', detail: `a ${stop.reason} break from ${stop.start} to ${stop.end}` }
  }
  const gap = longestGap(input.runs, start, end)
  if (gap.days >= rules.gapDays) {
    return { reason: 'gap', detail: `no run for ${gap.days} days from ${isoDay(gap.after + 1)}` }
  }
  if (input.checkIns === undefined) return { reason: 'check_ins_unread', detail: 'the morning check-ins could not be read' }
  const ill = input.checkIns.find((entry) => day(entry.date) >= start && day(entry.date) <= end && (entry.ill || entry.skipped === 'ill'))
  if (ill) return { reason: 'illness', detail: `illness reported on ${ill.date}` }
  const since = end - rules.niggle.lookbackDays + 1
  const niggle = (input.niggles ?? []).find((episode) => day(episode.to) >= since && day(episode.from) <= end
    && (episode.daysReported >= rules.niggle.daysReported || episode.peakPain >= rules.niggle.pain || episode.daysChangingRun > 0))
  if (niggle) {
    return { reason: 'niggle', detail: `a ${[niggle.side, niggle.site].filter(Boolean).join(' ')} niggle from ${niggle.from} to ${niggle.to}` }
  }
  if (input.fatigueFlagged) return { reason: 'fatigue', detail: 'the latest easy run flagged fatigue' }
  return null
}

/** Grows the next full week only on a block run through without a break, and only as far as every bound allows. */
export function blockGrowth(input: BlockGrowthInput): BlockGrowth {
  const limits = fullWeekLimits(input.band)
  const maxWeekKm = tenth(Math.min(limits.ceilingKm, limits.rampKm))
  const plan = input.plan
  const previous = plan && !plan.targetEvent ? previousFullWeek(plan) : null
  if (!plan || !previous) return { growth: { status: 'baseline' }, maxWeekKm }

  const held = (reason: GrowthHoldReason, detail: string): BlockGrowth => ({
    growth: { status: 'held', previousWeekKm: previous.km, weekKm: tenth(Math.min(previous.km, maxWeekKm)), reason, detail },
    maxWeekKm,
  })
  const start = day(plan.block.startDate)
  const end = Math.min(day(plan.block.endDate), day(input.referenceDate))
  const pause = breakInBlock(input, start, end)
  if (pause) return held(pause.reason, pause.detail)

  const grown = tenth(previous.km * CONTROLLED_THRESHOLD.blockGrowth.ratio)
  if (grown > limits.ceilingKm) return held('ceiling', 'the grown week would pass the volume ceiling set by recent running')
  if (grown > limits.rampKm) return held('ramp', 'the grown week would jump too far above the last weeks run')
  if (previous.longestKm > longSessionLimitKm(input.band, grown)) {
    return held('long_run', 'the last block\'s long run already sits past the long-run limit, so its runs did not reach it')
  }
  return { growth: { status: 'grown', previousWeekKm: previous.km, weekKm: grown }, maxWeekKm }
}
