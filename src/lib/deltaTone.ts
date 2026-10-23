/**
 * The arrow says which way a delta went, the colour whether that is good, so
 * "Fatigue ↓4" is a green down arrow. Never the accent: a trend is not a "now" marker.
 */

export type DeltaMetric =
  | 'fitness'
  | 'fatigue'
  | 'form'
  | 'vo2max'
  | 'pace'
  | 'race'
  | 'efficiency'
  | 'distance'
  | 'restingHr'
  | 'hrv'
  | 'loadRatio'
  | 'rampRate'

export type DeltaTone = 'good' | 'worse' | 'flat'

export const DELTA_TONE_COLOR: Record<DeltaTone, string> = {
  good: 'var(--good)',
  worse: 'var(--tone-caution)',
  flat: 'var(--muted-foreground)',
}

/** Form's neutral band, which "better" moves toward. */
const FORM_BAND = { lo: -10, hi: 5 } as const

const SAFE_RANGE: Partial<Record<DeltaMetric, { lo: number; hi: number }>> = {
  loadRatio: { lo: 0.8, hi: 1.3 },
  rampRate: { lo: -5, hi: 5 },
}

export interface DeltaContext {
  value?: number
  flatBelow?: number
}

const distanceToBand = (v: number) => (v < FORM_BAND.lo ? FORM_BAND.lo - v : v > FORM_BAND.hi ? v - FORM_BAND.hi : 0)

export function deltaTone(metric: DeltaMetric, delta: number | null | undefined, ctx: DeltaContext = {}): DeltaTone {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return 'flat'
  const { value } = ctx
  switch (metric) {
    case 'fitness':
      return Math.abs(delta) < 1 ? 'flat' : delta > 0 ? 'good' : 'worse'
    case 'fatigue':
      return Math.abs(delta) < 2 ? 'flat' : delta < 0 ? 'good' : 'worse'
    case 'form': {
      if (Math.abs(delta) < 2 || value === undefined) return 'flat'
      const before = distanceToBand(value - delta)
      const now = distanceToBand(value)
      return now < before ? 'good' : now > before ? 'worse' : 'flat'
    }
    case 'vo2max':
      return Math.abs(delta) < (ctx.flatBelow ?? 0.5) ? 'flat' : delta > 0 ? 'good' : 'worse'
    // Seconds, positive when slower.
    case 'pace':
      return Math.abs(delta) < 3 ? 'flat' : delta < 0 ? 'good' : 'worse'
    // No noise band: a percentage band left a 10K's +8 s grey beside an amber 5K +16 s.
    case 'race':
      return Math.round(delta) === 0 ? 'flat' : delta < 0 ? 'good' : 'worse'
    // m per heartbeat, compared as printed (hundredths) so the colour agrees with the number.
    case 'efficiency':
      return Math.round(Math.abs(delta) * 100) <= 2 ? 'flat' : delta > 0 ? 'good' : 'worse'
    // Against last year's figure: under 2% of it is the same year.
    case 'distance': {
      const base = value !== undefined ? value - delta : null
      if (!base || base <= 0) return delta > 0 ? 'good' : delta < 0 ? 'worse' : 'flat'
      return Math.abs(delta) / base < 0.02 ? 'flat' : delta > 0 ? 'good' : 'worse'
    }
    case 'restingHr':
      return Math.abs(delta) < (ctx.flatBelow ?? 1) ? 'flat' : delta < 0 ? 'good' : 'worse'
    // Overnight HRV, ms.
    case 'hrv':
      return Math.abs(delta) < (ctx.flatBelow ?? 3) ? 'flat' : delta > 0 ? 'good' : 'worse'
    case 'loadRatio':
    case 'rampRate': {
      const range = SAFE_RANGE[metric]!
      if (value === undefined) return 'flat'
      return value >= range.lo && value <= range.hi ? 'flat' : 'worse'
    }
  }
}

export function deltaColor(metric: DeltaMetric, delta: number | null | undefined, ctx?: DeltaContext): string {
  return DELTA_TONE_COLOR[deltaTone(metric, delta, ctx)]
}
