import type { ActivityDetailView } from './activityViews'
import { runVerdictTone, type VerdictTone as RunTone } from '@/domain/activity/runVerdict'
import { cardClass } from '@/components/ui/Card'
import { VerdictBlock, type VerdictTone } from '@/components/ui/Verdict'
import type { ReactNode } from 'react'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

interface Props {
  activity: ActivityDetailView
  aiVerdict: Insight | null
  /** How it felt - effort, conditions, shoe and the note - as a row of chips in the same card. */
  children?: ReactNode
}

/** One of the verdict card's chips (3.0): 12 px on the inset tile, 8 px radius. */
export const RUN_CHIP_CLASS =
  'hit-44 inline-flex min-h-[30px] min-w-0 items-center gap-1.5 rounded-lg bg-background px-2.5 py-1 text-xs text-[var(--text-2)]'

/** The verdict's tone as a status colour: a strong session is good news, a tough one a caution. */
const STATUS_TONE: Record<RunTone, VerdictTone> = {
  positive: 'pos',
  neutral: 'muted',
  caution: 'warn',
}

/**
 * The verdict (v4.17): an eyebrow with a status dot saying how the session
 * went, the headline, then the coach's sentence in text-2, on a plain card;
 * effort, conditions, shoe and the note follow as one row of chips (3.0) -
 * four full-width rows pushed the tabs a screen down. The body is at
 * most 150 characters, so it shows in full, with no clamp and no "Coach
 * insight" label. Without an AI verdict the card falls back to a headline and
 * invents no body.
 */
export function RunVerdict({ activity, aiVerdict, children }: Props) {
  const v = t.activity.verdict
  const tone = runVerdictTone(activity)
  const headline = aiVerdict?.headline ?? v.headline[tone](t.activityTypes[activity.type])

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="run-verdict">
      <VerdictBlock
        tone={STATUS_TONE[tone]}
        eyebrow={v.eyebrow[tone]}
        headline={headline}
        body={aiVerdict?.body ? <span data-testid="run-verdict-body">{aiVerdict.body}</span> : undefined}
      />
      {children && (
        <div className="flex flex-wrap gap-2" data-testid="run-chips">
          {children}
        </div>
      )}
    </section>
  )
}
