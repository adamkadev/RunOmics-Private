import { cn } from '@/lib/utils'
import { STATUS } from '@/lib/statusColors'

export type ExplainTone = 'positive' | 'neutral' | 'caution'

const TONE_CLASS: Record<ExplainTone, string> = {
  positive: STATUS.success.text,
  neutral:  'text-muted-foreground',
  caution:  STATUS.warning.text,
}

export function ChartExplain({ text, tone }: { text: string; tone: ExplainTone }) {
  return <p className={cn('mt-2 text-xs font-medium', TONE_CLASS[tone])}>{text}</p>
}
