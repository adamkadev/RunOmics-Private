import type { WorkoutStep } from '@/domain/activity/types'
import { formatDurationWords } from '@/lib/formatters'
import { WORKOUT_SEGMENT_COLORS, WORKOUT_SEGMENT_INK } from '@/lib/colors'
import { t } from '@/i18n'
import { findBody, repCaption, sessionParts, stepClock, stepSeconds } from './workoutSummary'

/**
 * A segment is only labelled once it owns enough of the bar to hold two glyphs
 * and an apostrophe. Widths are proportional, so this is the only handle we
 * have on them; a session of ten one-minute reps falls below the line and stays
 * unlabelled, which is the right answer anyway - ten identical `1'` would say
 * nothing the ten blocks do not already say.
 */
const LABEL_MIN_SHARE = 0.07

/** The narrowest a step draws, in minutes of bar. */
const MIN_STEP_MINUTES = 0.35

// The bar is filled in the zone the session targets and written in --zone-ink,
// which clears 7:1 on Z3 and Z4. It used to be navy text on a mid-blue fill -
// about 3:1 - and the blue said Z2 on a Z4 session.
const ZONE_INK = WORKOUT_SEGMENT_INK.effort
const RECOVERY_FILL = WORKOUT_SEGMENT_COLORS.recovery
// Warm-up/cool-down need to read as segments, not gaps - .18 sat close
// enough to the card's own light-mode tint that they blended into it.
const EASE_FILL = WORKOUT_SEGMENT_COLORS.warmup

function zoneFill(zone: number | null): string {
  return `var(--zone-${zone ?? 2})`
}

interface TileSegment {
  /** Seconds of the session the segment stands for: its share of the bar. */
  weight: number
  fill: string
}

/** The session's own block: its easy body, or its one block of work. */
function mainStep(steps: WorkoutStep[], body: WorkoutStep | null): WorkoutStep | null {
  const efforts = steps.filter((step) => step.kind === 'effort')
  return body ?? (efforts.length === 1 ? efforts[0]! : null)
}

/**
 * Today's session bar, segment by segment (design review, Oct 2026): every
 * step as long as it lasts, the body in the session's zone. A stride and the
 * jog after it are one sliver, the gap to the next sliver reading as the jog,
 * as the review drew them; between longer reps the recovery is a block of its
 * own, and none ends the session. Without steps, one block.
 */
export function tileSegments(steps: WorkoutStep[], zone: number | null): TileSegment[] {
  if (steps.length <= 1) return [{ weight: 1, fill: zoneFill(zone) }]
  const { body, strides } = sessionParts(steps)
  const main = mainStep(steps, body)
  // As the day card's bar: short reps inside an easy run take Z5.
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

/** "3 × 7:40", or "3 reps" for steps synced before their seconds were kept. */
function repsLabel(reps: WorkoutStep[]): string {
  const seconds = stepSeconds(reps[0]!)
  return seconds > 0 ? `${reps.length} × ${stepClock(seconds)}` : t.plan.session.repsOnly(reps.length)
}

/**
 * The words under the tile's bar: the body or the reps and their zone on the
 * left, "54 min · Z2" or "3 × 7:40 · Z4", what rides on them on the right,
 * "6 × 20s strides" or "4:00 rec". A continuous session says so.
 */
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

/**
 * The session tile's bar on Today (design review, Oct 2026): 12 pt, its
 * segments as long as their steps, and under it what it draws in words.
 */
function TileStructureBar({ steps, zoneWord, zone, totalSeconds }: { steps: WorkoutStep[]; zoneWord: string | null; zone: number | null; totalSeconds: number }) {
  const caption = tileCaption(steps, zoneWord, totalSeconds)
  return (
    <div data-testid="tile-structure">
      <div aria-hidden className="flex h-3 gap-[3px]">
        {tileSegments(steps, zone).map((segment, i) => (
          // Never thinner than 3 pt: a 20 s stride is a sliver, not nothing.
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

/**
 * The day card's own structure bar - continuous, or interval, drawn only from
 * steps the plan actually carries. Colour is the session's intensity (its
 * zone); whether it was done or is still planned is the state chip's job, not
 * the bar's. Completed activities have no logged interval breakdown in this
 * domain, so they always take the continuous path.
 */
export function SessionStructureBar({
  steps,
  zoneWord,
  zone,
  totalSeconds,
  variant = 'card',
}: {
  steps: WorkoutStep[]
  zoneWord: string | null
  /** The zone the session targets (RUN_TYPE_ZONE); Z2 when unknown. */
  zone: number | null
  /** The session's length; 0 when the plan gives none. */
  totalSeconds: number
  /** Today's session tile: a 12 pt bar with its caption under it (design review, Oct 2026). */
  variant?: 'card' | 'tile'
}) {
  if (variant === 'tile') return <TileStructureBar steps={steps} zoneWord={zoneWord} zone={zone} totalSeconds={totalSeconds} />

  const efforts = steps.filter((st) => st.kind === 'effort')
  const fill = zoneFill(zone)
  const ink = ZONE_INK
  // Short fast reps inside an easy run are strides: the reps take Z5, the body
  // keeps the session's own zone.
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

  // A session shouldn't finish mid-recovery: a rest jog tacked onto the very
  // end (no cool-down follows it) reads as an accident, not a plan, so it's
  // dropped rather than drawn as the bar's last block.
  const trimmedSteps = steps.length > 0 && steps[steps.length - 1]!.kind === 'recovery' ? steps.slice(0, -1) : steps

  const body = findBody(efforts)
  const warmup = trimmedSteps.find((st) => st.kind === 'warmup')
  const cooldown = trimmedSteps.find((st) => st.kind === 'cooldown')

  // Every block's width is its own rounded duration except the body: that one
  // absorbs whatever's left of the session total instead of carrying its own
  // independently-rounded minutes, so the bar always closes on the header's
  // duration rather than drifting from rounding several short reps up to a
  // full minute apiece.
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60))
  // Short steps keep their real length (a 20 s stride is a third of a
  // minute), with a floor so each one still draws.
  const width = (step: WorkoutStep) => Math.max((step.seconds ?? step.minutes * 60) / 60, MIN_STEP_MINUTES)
  const otherMinutes = trimmedSteps.filter((st) => st !== body).reduce((sum, st) => sum + width(st), 0)
  const bodyWeight = body ? Math.max(1, Math.round(totalMinutes - otherMinutes)) : null

  const weights = trimmedSteps.map((step) => (step === body ? bodyWeight! : width(step)))
  const s = t.plan.structure
  // The caption and the rep label come from the same steps as Today's and
  // Plan's detail line (workoutSummary): a 20 s stride reads "20s", not "1:00".
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
