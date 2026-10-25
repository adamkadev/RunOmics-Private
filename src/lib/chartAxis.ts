import { t } from '@/i18n'

/** Faster is up on every pace axis: pace is seconds per km, so the axis runs reversed. */
export function paceAxis(): { reversed: true; caption: string } {
  return { reversed: true, caption: t.paceAxis.caption }
}
