'use client'

import { useEffect, useState } from 'react'
import {
  Sparkles,
  Activity,
  TrendingUp,
  HeartPulse,
  CalendarCheck,
  Gauge,
  ShieldAlert,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import type {
  Insight,
  InsightSeverity,
  InsightType,
  InsightsInput,
  InsightsOutput,
} from '@/infrastructure/llm/types'
import { t } from '@/i18n'

const TYPE_ICON: Record<InsightType, LucideIcon> = {
  training_load: Activity,
  performance_trend: TrendingUp,
  vo2max: HeartPulse,
  consistency: CalendarCheck,
  pacing_efficiency: Gauge,
  injury_risk: ShieldAlert,
}

const SEVERITY: Record<InsightSeverity, { badge: string; icon: string }> = {
  low: { badge: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400' },
  medium: { badge: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400' },
  high: { badge: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400' },
}

interface Props {
  snapshot: InsightsInput
}

export function AiInsightsCard({ snapshot }: Props) {
  const [insights, setInsights] = useState<Insight[] | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as InsightsOutput
        setInsights(data.insights ?? [])
        setSource(res.headers.get('x-insights-source'))
      })
      .catch(() => setInsights([]))
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [snapshot])

  if (!loading && (!insights || insights.length === 0)) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-violet-600 dark:text-violet-400" />
        <h3 className="text-sm font-semibold text-foreground/80">{t.aiInsights.title}</h3>
        {!loading && source === 'fallback' && (
          <span className="ml-auto text-[11px] text-muted-foreground">{t.aiInsights.fallbackNote}</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" />
          {t.aiInsights.loading}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {insights!.map((insight, idx) => {
            const Icon = TYPE_ICON[insight.type]
            const { badge, icon } = SEVERITY[insight.severity]
            return (
              <li key={`${insight.type}-${idx}`} className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${badge}`}>
                  <Icon size={15} className={icon} />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{insight.title}</p>
                  <p className="text-sm leading-relaxed text-foreground/80">{insight.message}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
