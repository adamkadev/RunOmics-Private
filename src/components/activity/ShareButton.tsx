'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import { ShareCardModal } from './ShareCardModal'
import { t } from '@/i18n'

interface Props {
  activity: Activity
}

export function ShareButton({ activity }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [canShareFiles] = useState(
    () => typeof window !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
  )
  const [canCopyImage] = useState(
    () => typeof window !== 'undefined' && typeof navigator.clipboard?.write === 'function' && typeof window.ClipboardItem !== 'undefined'
  )

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-transform active:scale-95"
      >
        <Share2 size={13} />
        {t.activity.share}
      </button>

      {isOpen && (
        <ShareCardModal
          activity={activity}
          canShareFiles={canShareFiles}
          canCopyImage={canCopyImage}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
