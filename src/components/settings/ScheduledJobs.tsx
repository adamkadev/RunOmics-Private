'use client'

import { useState } from 'react'
import type { User } from 'firebase/auth'
import { ChevronRight } from 'lucide-react'
import type { JobEvent } from '@/domain/diagnostics/jobEvent'
import { t } from '@/i18n'
import { formatDate } from '@/lib/formatters'
import { authorizedFetch } from '@/lib/ownerFetch'
import { cn } from '@/lib/utils'
import { GROUP_CARD, GROUP_ROW } from './settingsGroup'

type Loaded = { status: 'idle' | 'loading' | 'failed' } | { status: 'ready'; jobs: JobEvent[] }

const clock = (iso: string) => new Date(iso).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })

/** Loaded on demand, like the phone's errors beside it. */
export function ScheduledJobs({ user }: { user: User | null }) {
  const d = t.settings.diagnostics
  const [loaded, setLoaded] = useState<Loaded>({ status: 'idle' })
  const open = loaded.status !== 'idle'

  async function toggle() {
    if (open) return setLoaded({ status: 'idle' })
    if (!user) return
    setLoaded({ status: 'loading' })
    try {
      const res = await authorizedFetch(user, '/api/job-events')
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { jobs?: JobEvent[] }
      setLoaded({ status: 'ready', jobs: body.jobs ?? [] })
    } catch {
      setLoaded({ status: 'failed' })
    }
  }

  return (
    <div className={GROUP_CARD} data-testid="scheduled-jobs">
      <button type="button" onClick={toggle} aria-expanded={open} className={cn(GROUP_ROW, 'transition-colors hover:bg-[var(--surface-2)]')}>
        <span>{d.scheduledJobs}</span>
        <ChevronRight size={16} aria-hidden="true" className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      {loaded.status === 'loading' && <p className="px-4 pb-3 text-sm text-muted-foreground">{d.loading}</p>}
      {loaded.status === 'failed' && <p className="px-4 pb-3 text-sm text-muted-foreground">{d.jobsLoadFailed}</p>}
      {loaded.status === 'ready' &&
        (loaded.jobs.length === 0 ? (
          <p className="px-4 pb-3 text-sm text-muted-foreground">{d.jobsNone}</p>
        ) : (
          <ul className="flex flex-col gap-2.5 px-4 pb-3.5">
            {loaded.jobs.map((job) => (
              <li key={job.route} className="flex flex-col gap-0.5 text-sm" data-testid="scheduled-job">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-foreground">{job.route}</span>
                  <span className={cn('shrink-0', job.outcome === 'error' ? 'text-[var(--neg)]' : 'text-muted-foreground')}>
                    {d.outcome[job.outcome]}
                    {job.outcome === 'error' && ` · ${job.error ?? job.status}`}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(job.at.slice(0, 10))} {clock(job.at)} · {d.trigger[job.trigger]}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
