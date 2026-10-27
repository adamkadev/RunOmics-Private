export const pushPaths = {
  run: (activityId: string) => `/activities/${encodeURIComponent(activityId)}`,
  shoe: (gearId: string) => `/shoes/${encodeURIComponent(gearId)}`,
  map: '/activities?view=map',
  plan: '/plan',
  goals: '/goals',
  analytics: '/analytics',
  settings: '/settings',
  comeback: '/records?tab=return',
} as const

/** This deployment's origin: `APP_URL` where set, else the production domain Vercel exposes to every function. */
export function appOrigin(): string | null {
  const configured = process.env.APP_URL?.trim()
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  const candidate = configured || (vercel ? `https://${vercel}` : '')
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

/** FCM refuses a `webpush.fcmOptions.link` that is not an absolute HTTPS URL. */
export function absolutePushLink(link: string | undefined): string | undefined {
  if (!link) return undefined
  if (link.startsWith('/') && !link.startsWith('//')) {
    const origin = appOrigin()
    return origin ? `${origin}${link}` : undefined
  }
  try {
    return new URL(link).protocol === 'https:' ? link : undefined
  } catch {
    return undefined
  }
}
