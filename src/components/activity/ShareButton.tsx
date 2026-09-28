'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/Button'
import type { ShareActivity } from '@/lib/shareCardStats'
import { t } from '@/i18n'

// The modal brings the 800-line canvas renderer and the map snapshot code
// with it. It is only ever drawn after a tap, so it loads then.
const ShareCardModal = dynamic(() => import('./ShareCardModal').then((m) => m.ShareCardModal), { ssr: false })

interface Props {
  activity: ShareActivity
  /** The current VO₂max grade, offered as an optional badge on the card. */
  vo2Grade?: string | null
}

export function ShareButton({ activity, vo2Grade = null }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [canShareFiles] = useState(
    () => typeof window !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
  )
  const [canCopyImage] = useState(
    () => typeof window !== 'undefined' && typeof navigator.clipboard?.write === 'function' && typeof window.ClipboardItem !== 'undefined'
  )

  return (
    <>
      {/* The page's one action, on the title row (v4.17): an outline
          button that says what it does, not an icon chip. */}
      <Button
        variant="secondary"
        onClick={() => setIsOpen(true)}
        className="h-[34px] shrink-0 bg-card px-3 font-normal"
      >
        {t.activity.share}
      </Button>

      {isOpen && (
        <ShareCardModal
          activity={activity}
          vo2Grade={vo2Grade}
          canShareFiles={canShareFiles}
          canCopyImage={canCopyImage}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
