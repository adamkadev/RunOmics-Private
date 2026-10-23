'use client'

import { useEffect, useRef } from 'react'
import { t } from '@/i18n'
import { APP_VERSION, BUILD_COMMIT } from '@/lib/version'

export const LONG_PRESS_MS = 500

interface Env {
  userAgent: string
  standalone: boolean
}

export function deviceSummary({ userAgent: ua, standalone }: Env): string {
  const ios = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)_(\d+)/)
  const android = ua.match(/Android (\d+(?:\.\d+)?)/)
  const os = ios
    ? `iOS ${ios[1]}.${ios[2]}`
    : android
      ? `Android ${android[1]}`
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /(CriOS|Chrome)\//.test(ua)
      ? 'Chrome'
      : /(FxiOS|Firefox)\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua) || ios
          ? 'Safari'
          : 'Browser'
  return `${os} · ${browser}${standalone ? ' PWA' : ''}`
}

export function buildReport(env: Env, version = APP_VERSION, commit = BUILD_COMMIT): string {
  return `RunOmics ${version} (${commit}) · ${deviceSummary(env)}`
}

function currentEnv(): Env {
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  return { userAgent: navigator.userAgent, standalone }
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
