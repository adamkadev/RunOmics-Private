import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Milestone } from '@/application/usecases/GetMilestones'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { MILESTONE_ICON, MILESTONE_ICON_CLASS } from '@/components/milestones/milestoneVisuals'
import { formatDateWithYear } from '@/lib/formatters'
import { t } from '@/i18n'

const PREVIEW_COUNT = 4

// Records are already shown just above in ProfileRecords - only show tiers/streaks here to avoid duplicating the same PRs twice.
export function Milestones({ milestones }: { milestones: Milestone[] }) {
  const nonRecord = milestones.filter((m) => m.type !== 'record')
  if (nonRecord.length === 0) return null

  const preview = nonRecord.slice(0, PREVIEW_COUNT)

  return (
    <GlassSurface variant="card" className="p-5">
      <h2 className="mb-3 text-sm font-bold text-foreground">{t.profile.milestones.title}</h2>

      <div className="grid grid-cols-2 gap-2">
        {preview.map((m, i) => {
          const Icon = MILESTONE_ICON[m.type]
          return (
            <div
              key={`${m.type}-${m.date}-${i}`}
              className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3"
            >
              <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-control border border-foreground/[0.08] bg-foreground/[0.06]">
                <Icon size={14} className={MILESTONE_ICON_CLASS[m.type]} />
              </span>
              <div className="truncate text-caption font-bold text-foreground">{m.label}</div>
              <div className="truncate text-micro text-muted-foreground">{m.detail}</div>
              <div className="mt-1 text-micro text-subtle">{formatDateWithYear(m.date)}</div>
            </div>
          )
        })}
      </div>

      {nonRecord.length > PREVIEW_COUNT && (
        <Link
          href="/milestones"
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent-text active:scale-95"
        >
          {t.profile.milestones.viewAll} <ArrowRight size={16} />
        </Link>
      )}
    </GlassSurface>
  )
}
