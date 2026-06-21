'use client'

import { useEffect, useRef, useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import { generateShareCardBlob, shareCardFileName } from '@/lib/shareCard'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  activity: Activity
}

type MenuState = 'closed' | 'open' | 'copied'

export function ShareButton({ activity }: Props) {
  const [menu, setMenu] = useState<MenuState>('closed')
  const [canShareFiles] = useState(
    () => typeof window !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
  )
  const [canCopyImage] = useState(
    () => typeof window !== 'undefined' && typeof navigator.clipboard?.write === 'function' && typeof window.ClipboardItem !== 'undefined'
  )
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (menu === 'closed') return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMenu('closed')
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menu])

  async function handleShare() {
    setMenu('closed')
    const blob = await generateShareCardBlob(activity)
    const file = new File([blob], shareCardFileName(activity), { type: 'image/png' })
    if (!navigator.canShare({ files: [file] })) return
    try {
      await navigator.share({ files: [file] })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    }
  }

  async function handleCopy() {
    const blob = await generateShareCardBlob(activity)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    setMenu('copied')
    setTimeout(() => setMenu('closed'), 1500)
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        onClick={() => setMenu((m) => (m === 'closed' ? 'open' : 'closed'))}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Share2 size={13} />
        {t.activity.share}
      </button>

      {menu !== 'closed' && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
          {canShareFiles && (
            <button
              onClick={handleShare}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Share2 size={13} />
              {t.activity.shareMenu.share}
            </button>
          )}
          {canCopyImage && (
            <button
              onClick={handleCopy}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted',
                menu === 'copied' ? 'text-accent-text' : 'text-foreground'
              )}
            >
              {menu === 'copied' ? <Check size={13} /> : <Copy size={13} />}
              {menu === 'copied' ? t.activity.shareMenu.copied : t.activity.shareMenu.copy}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
