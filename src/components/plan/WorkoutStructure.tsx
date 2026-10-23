import type { WorkoutStep } from '@/domain/activity/types'
import { formatDurationWords } from '@/lib/formatters'
import { WORKOUT_SEGMENT_COLORS, WORKOUT_SEGMENT_INK } from '@/lib/colors'
import { t } from '@/i18n'
import { findBody, repCaption, sessionParts, stepClock, stepSeconds } from './workoutSummary'

/** The share of the bar a label needs: two glyphs and an apostrophe. */
const LABEL_MIN_SHARE = 0.07

/** The narrowest a step draws, in minutes of bar. */
const MIN_STEP_MINUTES = 0.35

// --zone-ink clears 7:1 on the Z3 and Z4 fills.
const ZONE_INK = WORKOUT_SEGMENT_INK.effort
const RECOVERY_FILL = WORKOUT_SEGMENT_COLORS.recovery
const EASE_FILL = WORKOUT_SEGMENT_COLORS.warmup

function zoneFill(zone: number | null): string {
  return `var(--zone-${zone ?? 2})`
}

interface TileSegment {
  /** Seconds: the segment's share of the bar. */
  weight: number
  fill: string
}

function mainStep(steps: WorkoutStep[], body: WorkoutStep | null): WorkoutStep | null {
  const efforts = steps.filter((step) => step.kind === 'effort')
  return body ?? (efforts.length === 1 ? efforts[0]! : null)
}

/**
 * A stride and the jog after it are one sliver; between longer reps the
 * recovery is a block of its own, and none ends the session.
 */
export function tileSegments(steps: WorkoutStep[], zone: number | null): TileSegment[] {
  if (steps.length <= 1) return [{ weight: 1, fill: zoneFill(zone) }]
  const { body, strides } = sessionParts(steps)
  const main = mainStep(steps, body)
  // Short reps inside an easy run take Z5.
  const workFill = zone !== null && zone >= 3 ? zoneFill(zone) : zoneFill(5)
  const segments: TileSegment[] = []
  steps.forEach((step, i) => {
    const seconds = stepSeconds(step)
    if (step.kind === 'recovery') {
      const stride = strides && steps[i - 1]?.kind === 'effort' && steps[i - 1] !== main ? segments.at(-1) : undefined
      if (stride) stride.weight += seconds
      else if (i < steps.length - 1) segments.push({ weight: seconds, fill: RECOVERY_FILL })
      return
    }
    const easy = step.kind === 'warmup' || step.kind === 'cooldown'
    segments.push({ weight: seconds, fill: easy ? EASE_FILL : step === main ? zoneFill(zone) : workFill })
  })
  return segments
}

/** "3 reps" for steps synced before their seconds were kept. */
function repsLabel(reps: WorkoutStep[]): string {
  const seconds = stepSeconds(reps[0]!)
  return seconds > 0 ? `${reps.length} × ${stepClock(seconds)}` : t.plan.session.repsOnly(reps.length)
}

export function tileCaption(steps: WorkoutStep[], zoneWord: string | null, totalSeconds: number): { left: string | null; right: string | null } {
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(' · ') || null
  const { body, reps, strides } = sessionParts(steps)
  const main = mainStep(steps, body)
  if (steps.length <= 1 || (!main && reps.length === 0)) {
    return { left: join(totalSeconds > 0 ? formatDurationWords(totalSeconds) : null, zoneWord ? `${zoneWord} ${t.plan.continuous}` : null), right: null }
  }
  if (!main) {
    const recovery = steps.find((step) => step.kind === 'recovery')
    return { left: join(repsLabel(reps), zoneWord), right: recovery ? t.plan.row.recovery(stepClock(stepSeconds(recovery))) : null }
  }
  const left = join(formatDurationWords(stepSeconds(main)), zoneWord)
  if (reps.length === 0) return { left, right: null }
  const rep = stepSeconds(reps[0]!)
  return { left, right: strides && rep > 0 ? t.plan.structure.strides(reps.length, stepClock(rep)) : repsLabel(reps) }
}

function TileStructureBar({ steps, zoneWord, zone, totalSeconds }: { steps: WorkoutStep[]; zoneWord: string | null; zone: number | null; totalSeconds: number }) {
  const caption = tileCaption(steps, zoneWord, totalSeconds)
  return (
    <div data-testid="tile-structure">
      <div aria-hidden className="flex h-3 gap-[3px]">
        {tileSegments(steps, zone).map((segment, i) => (
          // A 20 s stride is a sliver, not nothing.
          <span key={i} className="min-w-[3px] rounded-[4px]" style={{ flexGrow: segment.weight, flexBasis: 0, background: segment.fill }} />
        ))}
      </div>
      {(caption.left || caption.right) && (
        <div className="mt-1.5 flex justify-between gap-3 text-[11.5px] leading-tight text-muted-foreground">
          <span>{caption.left}</span>
          {caption.right && <span className="text-right">{caption.right}</span>}
        </div>
      )}
    </div>
  )
}

/** Completed activities log no interval breakdown, so they always take the continuous path. */
export function SessionStructureBar({
  steps,
  zoneWord,
  zone,
  totalSeconds,
  variant = 'card',
}: {
  steps: WorkoutStep[]
  zoneWord: string | null
  /** Z2 when null. */
  zone: number | null
  /** 0 when the plan gives none. */
  totalSeconds: number
  variant?: 'card' | 'tile'
}) {
  if (variant === 'tile') return <TileStructureBar steps={steps} zoneWord={zoneWord} zone={zone} totalSeconds={totalSeconds} />

  const efforts = steps.filter((st) => st.kind === 'effort')
  const fill = zoneFill(zone)
  const ink = ZONE_INK
  // Strides inside an easy run take Z5; the body keeps the session's zone.
  const workFill = zone !== null && zone >= 3 ? fill : zoneFill(5)

  if (efforts.length <= 1) {
    const label = [formatDurationWords(totalSeconds), [zoneWord, t.plan.continuous].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(' · ')
    return (
      <div
        className="flex items-center justify-center overflow-hidden rounded-[5px]"
        style={{ height: '22px', background: fill }}
      >
        <span className="font-bold leading-none" style={{ fontSize: '11.5px', color: ink }}>
          {label}
        </span>
      </div>
    )
  }

  // A recovery jog at the very end, no cool-down after it, reads as an
  // accident rather than a plan.
  const trimmedSteps = steps.length > 0 && steps[steps.length - 1]!.kind === 'recovery' ? steps.slice(0, -1) : steps

  const body = findBody(efforts)
  const warmup = trimmedSteps.find((st) => st.kind === 'warmup')
  const cooldown = trimmedSteps.find((st) => st.kind === 'cooldown')

  // The body absorbs what's left of the total instead of its own rounded
  // minutes, so the bar closes on the header's duration.
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60))
  const width = (step: WorkoutStep) => Math.max((step.seconds ?? step.minutes * 60) / 60, MIN_STEP_MINUTES)
  const otherMinutes = trimmedSteps.filter((st) => st !== body).reduce((sum, st) => sum + width(st), 0)
  const bodyWeight = body ? Math.max(1, Math.round(totalMinutes - otherMinutes)) : null

  const weights = trimmedSteps.map((step) => (step === body ? bodyWeight! : width(step)))
  const s = t.plan.structure
  // As the detail line (workoutSummary): a 20 s stride reads "20s", not "1:00".
  const centerCaption = repCaption(trimmedSteps) ?? ''

  return (
    <div>
      <div className="flex items-end" style={{ gap: '3px' }}>
        {trimmedSteps.map((step, i) => {
          const isBody = step === body
          const isWork = step.kind === 'effort' && !isBody
          const share = weights[i]! / totalMinutes
          const labelled = isWork && share >= LABEL_MIN_SHARE

          if (isBody) {
            const bodyLabel = `${formatDurationWords(step.seconds ?? bodyWeight! * 60)}${zoneWord ? ` · ${zoneWord}` : ''}`
            return (
              <div
                key={i}
                className="flex items-center justify-center overflow-hidden rounded-[4px]"
                style={{ flexGrow: weights[i], flexBasis: 0, height: '22px', background: fill }}
              >
                <span className="truncate font-bold leading-none" style={{ fontSize: '11px', color: ink }}>
                  {bodyLabel}
                </span>
              </div>
            )
          }

          return (
            <div
              key={i}
              className="flex items-center justify-center overflow-hidden rounded-[4px]"
              style={{
                flexGrow: weights[i],
                flexBasis: 0,
                height: isWork ? '22px' : '16px',
                background: isWork ? workFill : step.kind === 'recovery' ? RECOVERY_FILL : EASE_FILL,
              }}
            >
              {labelled && (
                <span className="text-caption font-bold leading-none" style={{ color: ZONE_INK }}>
                  {s.min(step.minutes)}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {(warmup || cooldown || centerCaption) && (
        <div className="mt-1.5 grid grid-cols-3 items-center text-caption" style={{ color: 'var(--subtle-2)' }}>
          <span className="text-left">{warmup ? s.warmup : ''}</span>
          <span className="text-center">{centerCaption}</span>
          <span className="text-right">{cooldown ? s.cooldown : ''}</span>
        </div>
      )}
    </div>
  )
}
