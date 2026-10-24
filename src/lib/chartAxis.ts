import { t } from '@/i18n'

/** Faster is up on every pace axis: pace is seconds per km, so the axis runs reversed. */
export function paceAxis(): { reversed: true; caption: string } {
  return { reversed: true, caption: t.paceAxis.caption }
}

/** Past this many months a full label no longer fits every tick at 393 pt. */
const MONTH_INITIALS_OVER = 6

/** `interval: 0`, or Recharts drops a month to make room; past six months each tick shortens to its initial. */
export function monthAxis(count: number): { interval: 0; tickFormatter: (label: string) => string } {
  return {
    interval: 0,
    tickFormatter: (label: string) => (count > MONTH_INITIALS_OVER ? label.slice(0, 1) : label),
  }
}
