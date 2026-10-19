import { FORM_BAND_THRESHOLDS, formBand } from '@/domain/training/formBand'
import { formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

export const FORM_SCALE = { min: -40, max: 25 } as const

const SIZE = 124
const STROKE = 11
const SWEEP_DEG = 240
const RADIUS = (SIZE - STROKE) / 2
const CENTER = SIZE / 2

export function dialFraction(form: number): number {
  const clamped = Math.min(FORM_SCALE.max, Math.max(FORM_SCALE.min, form))
  return (clamped - FORM_SCALE.min) / (FORM_SCALE.max - FORM_SCALE.min)
}

function point(fraction: number): [number, number] {
  const rad = ((SWEEP_DEG * fraction - SWEEP_DEG / 2) * Math.PI) / 180
  return [CENTER + RADIUS * Math.sin(rad), CENTER - RADIUS * Math.cos(rad)]
}

function arc(from: number, to: number): string {
  const [x1, y1] = point(from)
  const [x2, y2] = point(to)
  const large = SWEEP_DEG * (to - from) > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x2} ${y2}`
}

export function FormDial({ form }: { form: number }) {
  const { tiredBelow, freshAbove } = FORM_BAND_THRESHOLDS
  const tiredEnd = dialFraction(tiredBelow)
  const freshStart = dialFraction(freshAbove)
  const marker = dialFraction(form)
  const [markerX, markerY] = point(marker)
  const band = formBand(form)

  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      data-testid="form-dial"
      data-fraction={marker.toFixed(4)}
      role="img"
      aria-label={t.dashboard.readiness.formOnDial(formatDelta(form), t.formBand[band])}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <path d={arc(0, tiredEnd)} fill="none" stroke="var(--warn)" strokeOpacity={0.5} strokeWidth={STROKE} strokeLinecap="round" />
        <path d={arc(tiredEnd, freshStart)} fill="none" stroke="var(--line-2)" strokeWidth={STROKE} />
        <path d={arc(freshStart, 1)} fill="none" stroke="var(--pos)" strokeOpacity={0.5} strokeWidth={STROKE} strokeLinecap="round" />
        <circle data-testid="form-dial-marker" cx={markerX} cy={markerY} r={7} fill="var(--foreground)" stroke="var(--card)" strokeWidth={3} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[38px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">{formatDelta(form)}</span>
        <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t.dashboard.readiness.formLabel}</span>
      </div>
    </div>
  )
}
