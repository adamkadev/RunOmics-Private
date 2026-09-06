import { t } from '@/i18n'

export function ChartExplain({ text }: { text: string }) {
  return (
    <p className="mt-2 text-caption leading-snug text-muted-foreground">
      <span className="font-semibold">{t.analytics.readingLabel} </span>
      {text}
    </p>
  )
}
