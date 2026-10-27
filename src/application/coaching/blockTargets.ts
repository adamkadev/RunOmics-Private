import type { Activity } from '@/domain/activity/types'
import type { CoachingPlan, TrainingWeek } from '@/domain/coaching/types'
import type { CheckIn, NiggleEpisode } from '@/domain/wellness/checkIn'
import { DAY_MS } from '@/lib/calendarDate'
import type { TrainingBreak } from '@/infrastructure/repositories/JsonAthleteRepository'
import { planEasyPace } from '@/domain/coaching/sessionDistance'
import { controlledStep, type FatigueReading } from './autoregulation'
import { CONTROLLED_THRESHOLD, type BlockSignal, type BlockTargets } from './controlledThreshold'
import { fullWeekLimits, weekKm, type VolumeBand } from './volume'

export interface BlockTargetsInput {
  /** The block being renewed. */
  plan: CoachingPlan | null
  runs: Activity[]
  referenceDate: string
  /** Undefined when the check-ins could not be read, which is not the same as none written. */
  checkIns?: ({ date: string } & CheckIn)[]
  niggles?: NiggleEpisode[]
  breaks?: TrainingBreak[]
  fatigue: FatigueReading | null
  best4WeekAverageKm: number
  band: VolumeBand
  maxWeeklyKm?: number
}

const day = (date: string) => Math.floor(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY_MS)
const isoDay = (days: number) => new Date(days * DAY_MS).toISOString().slice(0, 10)

function holdsDose(week: TrainingWeek): boolean {
  const { fullWeek, block } = CONTROLLED_THRESHOLD
  const steps = week.workouts.filter((workout) => workout.status !== 'cancelled').map(controlledStep).filter((step) => step !== null)
  const minutes = steps.reduce((sum, { repetitions, step }) => sum + repetitions * step.target.durationSeconds!, 0) / 60
  return steps.length >= fullWeek.sessions && minutes >= fullWeek.sessions * fullWeek.sessionMinutes * block.fullDoseShare
}

/** The first whole week that held the dose: a partial lead-in carries only part of it. */
function previousWeek1Km(plan: CoachingPlan | null): number | null {
  if (!plan || plan.targetEvent) return null
  const week = [...plan.weeks]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .find((candidate) => day(candidate.endDate) - day(candidate.startDate) === 6 && holdsDose(candidate))
  if (!week) return null
  const running = { ...week, workouts: week.workouts.filter((workout) => workout.status !== 'cancelled') }
  return Math.round(weekKm(running, planEasyPace(running.workouts)))
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

interface Signal {
  signal: BlockSignal
  reasons: string[]
  /** Red for a stop rather than a warning: the block resumes no higher than the recent running. */
  afterBreak: boolean
}

function readSignal(input: BlockTargetsInput, start: number, end: number, renewing: boolean): Signal {
  const rules = CONTROLLED_THRESHOLD.block
  const red: string[] = []
  const yellow: string[] = []
  let afterBreak = false

  for (const pause of input.breaks ?? []) {
    if (day(pause.end) < start || day(pause.start) > end) continue
    if (pause.reason !== 'injury' && pause.reason !== 'illness' && pause.reason !== 'pregnancy') continue
    red.push(`a ${pause.reason} break from ${pause.start} to ${pause.end}`)
    afterBreak = true
  }
  const gap = longestGap(input.runs, start, end)
  if (gap.days >= rules.gapDays) {
    red.push(`no run for ${gap.days} days from ${isoDay(gap.after + 1)}`)
    afterBreak = true
  }
  if (renewing && end - start + 1 < rules.minBlockDays) red.push(`the last block ran only ${end - start + 1} days`)
  const ill = input.checkIns?.find((entry) => day(entry.date) >= start && day(entry.date) <= end && (entry.ill || entry.skipped === 'ill'))
  if (ill) {
    red.push(`illness reported on ${ill.date}`)
    afterBreak = true
  }

  const nigglesSince = end - rules.niggle.lookbackDays + 1
  for (const niggle of input.niggles ?? []) {
    if (day(niggle.to) < nigglesSince || day(niggle.from) > end || niggle.peakPain === 0) continue
    const where = [niggle.side, niggle.site].filter(Boolean).join(' ')
    const serious = niggle.peakPain >= rules.niggle.pain || niggle.daysChangingRun > 0 || niggle.daysReported >= rules.niggle.daysReported
    const report = `a ${where} niggle from ${niggle.from} to ${niggle.to}, pain up to ${niggle.peakPain}`
    if (serious) red.push(report)
    else yellow.push(report)
  }

  const fatigue = input.fatigue
  const above = fatigue?.normalHr == null ? null : Math.round(fatigue.run.hr - fatigue.normalHr)
  if (fatigue?.flagged) red.push(`the easy run on ${fatigue.run.date} flagged fatigue, heart rate ${above} bpm above normal`)
  else if (above !== null && above >= rules.easyHrAboveNormalBpm) yellow.push(`the easy run on ${fatigue!.run.date} ran ${above} bpm above normal`)

  if (input.checkIns === undefined) {
    yellow.push('the morning check-ins could not be read')
  } else {
    const since = day(input.referenceDate) - rules.poorCheckIns.lookbackDays + 1
    const worst = rules.poorCheckIns.worstScore
    const poor = input.checkIns.filter((entry) => day(entry.date) >= since
      && [entry.sleep, entry.soreness, entry.stress].some((score) => score !== undefined && score <= worst))
    if (poor.length >= rules.poorCheckIns.count) yellow.push(`${poor.length} poor check-ins in the last ${rules.poorCheckIns.lookbackDays} days`)
  }

  if (red.length) return { signal: 'red', reasons: red, afterBreak }
  if (yellow.length) return { signal: 'yellow', reasons: yellow, afterBreak }
  const calm = above === null ? 'no easy-run comparison to read' : `easy-run heart rate ${above >= 0 ? '+' : ''}${above} bpm on normal`
  return { signal: 'green', reasons: [`no fatigue flag, illness, niggle, gap or run of poor check-ins; ${calm}`], afterBreak }
}

/** The capacity ceiling guards week 1 alone against a jump, so a long build can pass a capacity not yet shown. */
export function blockTargets(input: BlockTargetsInput): BlockTargets {
  const previousWeek1 = previousWeek1Km(input.plan)
  const renewing = previousWeek1 !== null
  const reference = day(input.referenceDate)
  const start = renewing ? day(input.plan!.block.startDate) : reference - 27
  const end = renewing ? Math.min(day(input.plan!.block.endDate), reference) : reference
  const { signal, reasons, afterBreak } = readSignal(input, start, end, renewing)

  const rise = signal === 'red' ? 0 : CONTROLLED_THRESHOLD.block.weeklyRise[signal]
  const limits = fullWeekLimits(input.band)
  const max = input.maxWeeklyKm ?? Infinity
  const heldBy = new Set<string>()
  const cap = (km: number, bounds: [number, string][]) => bounds.reduce((value, [bound, name]) => {
    if (value <= bound) return value
    heldBy.add(name)
    return bound
  }, km)
  const maximum: [number, string] = [max, `the athlete's weekly maximum of ${max} km`]

  let week1 = renewing ? previousWeek1 * (1 + rise) : input.best4WeekAverageKm
  if (afterBreak) week1 = cap(week1, [[input.band.baselineKm, 'the running since the break']])
  week1 = cap(week1, [[limits.ceilingKm, 'the volume ceiling set by recent running'], [limits.rampKm, 'the ramp from the last weeks run'], maximum])
  const loading = [week1]
  for (let index = 1; index < 3; index++) loading.push(cap(loading[index - 1]! * (1 + rise), [maximum]))
  const rounded = loading.map(Math.round)
  const lighter = Math.round(rounded[2]! * (1 - CONTROLLED_THRESHOLD.lighterWeek.easyCut))

  return {
    signal,
    reasons,
    weeklyRisePct: Math.round(rise * 100),
    previousWeek1Km: previousWeek1,
    weekKmTargets: [...rounded, lighter],
    heldBy: [...heldBy],
  }
}
