'use client'

import { useEffect, useRef } from 'react'
import { t } from '@/i18n'
import { APP_VERSION, BUILD_COMMIT } from '@/lib/version'
import { currentEnv, deviceSummary, type Env } from '@/lib/device'

export { deviceSummary }

export const LONG_PRESS_MS = 500

export function buildReport(env: Env, version = APP_VERSION, commit = BUILD_COMMIT): string {
  return `RunOmics ${version} (${commit}) · ${deviceSummary(env)}`
}

export function BuildInfo({ onCopied }: { onCopied: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancel() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => cancel, [])

  function start() {
    cancel()
    timer.current = setTimeout(() => {
      timer.current = null
      navigator.clipboard?.writeText(buildReport(currentEnv())).then(onCopied, () => {})
    }, LONG_PRESS_MS)
  }

  return (
    <p
      data-testid="build-info"
      className="select-none px-1 pt-1.5 text-center text-xs tabular-nums text-subtle [-webkit-touch-callout:none]"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {t.settings.about(APP_VERSION, BUILD_COMMIT)}
    </p>
  )
}
