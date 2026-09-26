import type { ActivityDetailView } from './activityViews'
import { runVerdictTone } from '@/domain/activity/runVerdict'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { ReactNode } from 'react'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

interface Props {
  activity: ActivityDetailView
  aiVerdict: Insight | null
  /** How it felt - effort and the note - under a divider in the same card. */
  children?: ReactNode
}

/**
 * The verdict: the headline, then the coach's sentence in muted ink (v4.8
 * 2e, reversing H10's headline-only card), then effort, conditions, shoe
 * and the note in the same card. The body is at most 150 characters, so it
 * shows in full, with no clamp and no "Coach insight" label. Without an AI
 * verdict the card falls back to a headline and invents no body. The
 * headline reads in text ink whatever its tone (v4.3.1).
 */
export function RunVerdict({ activity, aiVerdict, children }: Props) {
  const v = t.activity.verdict
  const tone = runVerdictTone(activity)
  const headline = aiVerdict?.headline ?? v.headline[tone](t.activityTypes[activity.type])

  return (
    <GlassSurface variant="card" className="overflow-hidden rounded-card-sm px-4" data-testid="run-verdict">
      <p className="pt-3.5 font-display text-title3 font-bold leading-tight text-foreground">{headline}</p>
      {aiVerdict?.body && (
        <p className="mt-1.5 text-subhead leading-snug text-muted-foreground text-pretty" data-testid="run-verdict-body">
          {aiVerdict.body}
        </p>
      )}
      {children && <div className="mt-3 border-t border-border">{children}</div>}
    </GlassSurface>
  )
}
