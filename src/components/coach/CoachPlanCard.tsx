'use client'

import { useEffect, useState } from 'react'
import { CalendarRange, Check, Loader2, Target, Sparkles } from 'lucide-react'
import { ACTIVITY_TYPE_CONFIG, type ActivityType } from '@/domain/activity/types'
import type { PlanConfidence, PlanInput, SessionKind, TrainingPlan } from '@/infrastructure/llm/plan/types'
import { t } from '@/i18n'

const NON_ACTIVITY_KIND_STYLE: Record<'rest' | 'cross_training', string> = {
  rest: 'bg-muted text-muted-foreground',
  cross_training: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
}

function kindBadgeClass(kind: SessionKind): string {
  return kind === 'rest' || kind === 'cross_training'
    ? NON_ACTIVITY_KIND_STYLE[kind]
    : ACTIVITY_TYPE_CONFIG[kind as ActivityType].badgeClass
}

function kindLabel(kind: SessionKind): string {
  return kind === 'rest' ? t.coachPlan.restDay : kind === 'cross_training' ? t.coachPlan.crossTraining : t.activityTypes[kind as ActivityType]
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

          <div className="mt-4 divide-y divide-border">
            {plan!.sessions.map((s, idx) => (
              <div
                key={`${s.day}-${idx}`}
                className="grid grid-cols-[2.5rem_5.5rem_1fr_auto] items-start gap-3 py-2.5 sm:grid-cols-[3rem_6.5rem_1fr_auto]"
              >
                <span className="pt-0.5 text-xs font-medium text-subtle">{s.day.slice(0, 3)}</span>

                <span className={`flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${kindBadgeClass(s.kind)} ${s.completed ? 'opacity-60' : ''}`}>
                  {s.completed && <Check size={11} />}
                  {kindLabel(s.kind)}
                </span>

                <div className="min-w-0">
                  <p className={`text-sm font-medium text-foreground ${s.completed ? 'opacity-60' : ''}`}>{s.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{s.description}</p>
                </div>

                <span className="whitespace-nowrap pt-0.5 text-right text-xs tabular-nums text-subtle">
                  {s.distanceKm ? `${s.distanceKm} km` : ''}
                  {s.distanceKm && s.targetPace ? ' · ' : ''}
                  {s.targetPace ?? ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
