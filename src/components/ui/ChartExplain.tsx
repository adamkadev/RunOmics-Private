import { t } from '@/i18n'

// "Reading:" line under a chart - a plain-language takeaway, not a repeat of
// the axis values. Always muted (never colored by sentiment): the point is
// legibility and consistency across every chart, not a status signal.
export function ChartExplain({ text }: { text: string }) {
  return (
    <p className="mt-2 text-caption leading-snug text-muted-foreground">
      <span className="font-semibold">{t.analytics.readingLabel} </span>
      {text}
    </p>
  )
}
