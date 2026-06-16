'use client'

import { useEffect, useState } from 'react'
import { CalendarRange, Loader2, Target, Sparkles } from 'lucide-react'
import type { PlanInput } from '@/infrastructure/llm/plan/types'
import type { PlanConfidence, SessionKind, TrainingPlan } from '@/infrastructure/llm/plan/types'
import { t } from '@/i18n'

const KIND_STYLE: Record<SessionKind, string> = {
  rest: 'bg-muted text-muted-foreground',
  recovery: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  easy: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  long: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  tempo: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  threshold: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  intervals: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  race_pace: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  cross_training: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
}

const CONFIDENCE_OPACITY: Record<PlanConfidence, string> = {
  low: 'opacity-50',
  medium: 'opacity-75',
  high: 'opacity-100',
}

interface Props {
  snapshot: PlanInput
}

export function CoachPlanCard({ snapshot }: Props) {
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as { plan: TrainingPlan | null }
        setPlan(data.plan)
      })
      .catch(() => setPlan(null))
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [snapshot])

  if (!loading && !plan) return null

  const p = t.coachPlan

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-violet-600 dark:text-violet-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{p.title}</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-card">
          <Loader2 size={15} className="animate-spin" />
          {p.loading}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Target size={15} className="text-violet-500" />
              <span className="text-xs text-subtle">{p.weekFocus}</span>
              <span className="text-sm font-semibold text-foreground">{plan!.focus}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarRange size={15} className="text-violet-500" />
              <span className="text-xs text-subtle">{p.targetWeekly}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{plan!.targetWeeklyKm} km</span>
            </div>
            <span className={`ml-auto text-[11px] text-muted-foreground ${CONFIDENCE_OPACITY[plan!.confidence]}`}>
              {p.confidence[plan!.confidence]}
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-foreground/80">{plan!.rationale}</p>

          {plan!.keyWorkout && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">{p.keyWorkout}:</span> {plan!.keyWorkout}
            </p>
          )}

          <ul className="mt-4 divide-y divide-border">
            {plan!.sessions.map((s, idx) => (
              <li key={`${s.day}-${idx}`} className="flex items-start gap-3 py-2.5">
                <span className="w-9 shrink-0 pt-0.5 text-xs font-medium text-subtle">{s.day.slice(0, 3)}</span>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${KIND_STYLE[s.kind]}`}>
                  {t.coachPlan.kind[s.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{s.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-subtle">
                      {s.distanceKm ? `${s.distanceKm} km` : ''}
                      {s.distanceKm && s.targetPace ? ' · ' : ''}
                      {s.targetPace ?? ''}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{s.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
