'use client'

import { useState } from 'react'
import type { User } from 'firebase/auth'
import { ChevronRight } from 'lucide-react'
import type { ClientErrorReport } from '@/domain/diagnostics/clientError'
import { t } from '@/i18n'
import { formatDate } from '@/lib/formatters'
import { authorizedFetch } from '@/lib/ownerFetch'
import { cn } from '@/lib/utils'
import { GROUP_CARD, GROUP_ROW } from './settingsGroup'

type Loaded = { status: 'idle' | 'loading' | 'failed' } | { status: 'ready'; errors: ClientErrorReport[] }

const clock = (iso: string) => new Date(iso).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })

/** Loaded on demand: most visits to Settings never need them. */
export function RecentErrors({ user }: { user: User | null }) {
  const d = t.settings.diagnostics
  const [loaded, setLoaded] = useState<Loaded>({ status: 'idle' })
  const open = loaded.status !== 'idle'

  async function toggle() {
    if (open) return setLoaded({ status: 'idle' })
    if (!user) return
    setLoaded({ status: 'loading' })
    try {
      const res = await authorizedFetch(user, '/api/client-errors')
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { errors?: ClientErrorReport[] }
      setLoaded({ status: 'ready', errors: body.errors ?? [] })
    } catch {
      setLoaded({ status: 'failed' })
    }
  }

  return (
    <div className={GROUP_CARD} data-testid="recent-errors">
      <button type="button" onClick={toggle} aria-expanded={open} className={cn(GROUP_ROW, 'transition-colors hover:bg-[var(--surface-2)]')}>
        <span>{d.recentErrors}</span>
        <ChevronRight size={16} aria-hidden="true" className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      {loaded.status === 'loading' && <p className="px-4 pb-3 text-sm text-muted-foreground">{d.loading}</p>}
      {loaded.status === 'failed' && <p className="px-4 pb-3 text-sm text-muted-foreground">{d.loadFailed}</p>}
      {loaded.status === 'ready' &&
        (loaded.errors.length === 0 ? (
          <p className="px-4 pb-3 text-sm text-muted-foreground">{d.none}</p>
        ) : (
          <ul className="flex flex-col gap-2.5 px-4 pb-3.5">
            {loaded.errors.map((error) => (
              <li key={`${error.at}|${error.message}`} className="flex flex-col gap-0.5 text-sm" data-testid="recent-error">
                <span className="text-xs text-muted-foreground">
                  {formatDate(error.at.slice(0, 10))} {clock(error.at)} · {error.page} · {error.source}
                </span>
                <span className="break-words text-foreground">{error.message}</span>
                <span className="text-xs text-subtle">
                  {error.build} · {error.device}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
