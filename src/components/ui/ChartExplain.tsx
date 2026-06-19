import { cn } from '@/lib/utils'

export type ExplainTone = 'positive' | 'neutral' | 'caution'

const TONE_CLASS: Record<ExplainTone, string> = {
  positive: 'text-accent-text',
  neutral:  'text-muted-foreground',
  caution:  'text-amber-600 dark:text-amber-400',
}

export function ChartExplain({ text, tone }: { text: string; tone: ExplainTone }) {
  return <p className={cn('mt-2 text-xs font-medium', TONE_CLASS[tone])}>{text}</p>
}
