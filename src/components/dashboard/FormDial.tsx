import { formBand } from '@/domain/training/formBand'
import { formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

/** The Form scale's ends: deep in the training zone to well rested. Past them the dial rests on the edge. */
export const FORM_SCALE = { min: -40, max: 25 } as const

const SIZE = 104
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** A 270° arc, open at the bottom. */
const ARC = CIRCUMFERENCE * 0.75

/** How much of the arc Form fills, 0-1, on FORM_SCALE. */
export function dialFraction(form: number): number {
  const clamped = Math.min(FORM_SCALE.max, Math.max(FORM_SCALE.min, form))
  return (clamped - FORM_SCALE.min) / (FORM_SCALE.max - FORM_SCALE.min)
}

/**
 * Form as one dial (design review 3.0, mock 1b): a 270° arc filled in the
 * accent as far as today's Form, the number in its middle. The band it falls
 * in is said beside it, in the card's status line, and read out here -
 * never the fill alone.
 */
export function FormDial({ form }: { form: number }) {
  const fraction = dialFraction(form)
  const filled = ARC * fraction
  const value = formatDelta(form)
  // Starts bottom-left (135°) and runs clockwise over the top.
  const circle = { cx: SIZE / 2, cy: SIZE / 2, r: RADIUS, fill: 'none', strokeWidth: STROKE, strokeLinecap: 'round' as const, transform: `rotate(135 ${SIZE / 2} ${SIZE / 2})` }
  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      data-testid="form-dial"
      data-fraction={fraction.toFixed(4)}
      role="img"
      aria-label={t.dashboard.readiness.formOnDial(value, t.formBand[formBand(form)])}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <circle {...circle} stroke="var(--line-2)" strokeDasharray={`${ARC} ${CIRCUMFERENCE}`} />
        {filled > 0 && <circle {...circle} stroke="var(--accent)" strokeDasharray={`${filled} ${CIRCUMFERENCE}`} data-testid="form-dial-fill" />}
      </svg>
      <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="text-[34px] font-bold leading-none tracking-[-0.02em] tabular-nums text-foreground">{value}</span>
        <span className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">{t.dashboard.readiness.formLabel}</span>
      </div>
    </div>
  )
}
