/**
 * What a delta means, coloured by it (v4.7): improving is --good, getting
 * worse is amber, and a change too small to mean anything is muted. The arrow
 * still says which way; the colour says whether that is good, so "Fatigue ↓4"
 * is a green down arrow. Every screen reads a metric's delta through here, so
 * the same metric is the same colour on Today, Analytics and Progress.
 *
 * Only the arrow and the delta text take the colour; the value beside it stays
 * ink. Never the accent: a trend is not a "now" marker.
 */

export type DeltaMetric =
  | 'fitness'
  | 'fatigue'
  | 'form'
  | 'vo2max'
  | 'pace'
  | 'race'
  | 'efficiency'
  | 'heartRate'
  | 'distance'
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

/** Where a load marker is safe; outside it is worse, inside it says nothing. */
const SAFE_RANGE: Partial<Record<DeltaMetric, { lo: number; hi: number }>> = {
  loadRatio: { lo: 0.8, hi: 1.3 },
  rampRate: { lo: -5, hi: 5 },
}

export interface DeltaContext {
  /**
   * The value now. Form needs it to tell whether the change moved toward the
   * neutral band; a distance needs it for its percentage threshold; the load
   * markers need it for their safe range.
   */
  value?: number
  /**
   * A tighter or looser neutral band for one screen: the VO₂max grade's
   * 30-day change reads 0.3 as noise (v5.3) where the 12-week tiles use 0.5.
   */
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
    // A predicted race time: any slower time is a caution, any faster good
    // news (design review, Oct 2026) - a 0.5 % band left the 10K's +8 s grey
    // beside an amber 5K +16 s. Level only when it prints as 0 s.
    case 'race':
      return Math.round(delta) === 0 ? 'flat' : delta < 0 ? 'good' : 'worse'
    // m per heartbeat, printed to two decimals: up to 0.02 is week-to-week
    // noise (v4.16.4). Compared as printed, in hundredths, so the colour always
    // agrees with the number beside it.
    case 'efficiency':
      return Math.round(Math.abs(delta) * 100) <= 2 ? 'flat' : delta > 0 ? 'good' : 'worse'
    // bpm for the same work: lower is fitter. A 12-week mean of resting HR moves less than one easy run does.
    case 'heartRate':
      return Math.abs(delta) < (ctx.flatBelow ?? 2) ? 'flat' : delta < 0 ? 'good' : 'worse'
    // Against last year's figure: under 2% of it is the same year.
    case 'distance': {
      const base = value !== undefined ? value - delta : null
      if (!base || base <= 0) return delta > 0 ? 'good' : delta < 0 ? 'worse' : 'flat'
      return Math.abs(delta) / base < 0.02 ? 'flat' : delta > 0 ? 'good' : 'worse'
    }
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
