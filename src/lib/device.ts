export interface Env {
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

export function currentEnv(): Env {
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  return { userAgent: navigator.userAgent, standalone }
}
