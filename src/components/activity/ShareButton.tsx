'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Share } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import { t } from '@/i18n'

// The modal brings the 800-line canvas renderer and the map snapshot code
// with it. It is only ever drawn after a tap, so it loads then.
const ShareCardModal = dynamic(() => import('./ShareCardModal').then((m) => m.ShareCardModal), { ssr: false })

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
        aria-label={t.activity.share}
        className="glass-chip inline-flex shrink-0 items-center justify-center rounded-full p-2 text-foreground transition-transform active:scale-95 active:opacity-80"
      >
        <Share size={16} />
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
