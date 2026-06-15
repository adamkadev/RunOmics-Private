import { Sparkles, TrendingUp, TriangleAlert, Info } from 'lucide-react'
import type { Insight, InsightTone } from '@/application/usecases/GetInsights'
import { t } from '@/i18n'

const TONE: Record<InsightTone, { Icon: typeof Info; badge: string; icon: string }> = {
  positive: {
    Icon: TrendingUp,
    badge: 'bg-emerald-50 dark:bg-emerald-900/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    Icon: TriangleAlert,
    badge: 'bg-amber-50 dark:bg-amber-900/20',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    Icon: Info,
    badge: 'bg-blue-50 dark:bg-blue-900/20',
    icon: 'text-blue-600 dark:text-blue-400',
  },
}

export function InsightsCard({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-semibold text-foreground/80">{t.insights.title}</h3>
      </div>

      <ul className="space-y-2.5">
        {insights.map(({ id, tone, text }) => {
          const { Icon, badge, icon } = TONE[tone]
          return (
            <li key={id} className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${badge}`}>
                <Icon size={15} className={icon} />
              </span>
              <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
