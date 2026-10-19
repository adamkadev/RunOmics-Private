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
  positive: 'accent',
  neutral: 'accent',
  caution: 'warn',
}

export function RunVerdict({ activity, aiVerdict, children }: Props) {
  const v = t.activity.verdict
  const tone = runVerdictTone(activity)
  const session = v.headline[tone](t.activityTypes[activity.type])
  const eyebrow = `${v.eyebrow[tone]} · ${session}`

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="run-verdict">
      <VerdictBlock
        tone={STATUS_TONE[tone]}
        eyebrow={eyebrow}
        headline={aiVerdict?.headline ?? null}
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
