const NO_GLOBAL_TOP_BAR_BASES = ['/profile', '/settings', '/map']
const ACTIVITY_DETAIL_PATTERN = /^\/activities\/[^/]+$/

/**
 * Profile and Settings manage their own header entirely (no global RunOmics
 * top bar with brand/theme toggle/profile shortcut) since they're already
 * reached via that shortcut or show the user's own identity. Activity
 * detail and the full-screen Map also hide it: both have their own inline
 * back affordance and the brand logo would just eat vertical space above
 * content (the session title, the map canvas) that should dominate the
 * screen. Every other page keeps the global top bar.
 */
export function hasGlobalTopBar(pathname: string): boolean {
  if (ACTIVITY_DETAIL_PATTERN.test(pathname)) return false
  return !NO_GLOBAL_TOP_BAR_BASES.some((base) => pathname === base || pathname.startsWith(`${base}/`))
}

const PAGE_AURORA_BASES = ['/goals', '/records', '/shoes', '/settings', '/analytics'] as const

/**
 * Goals/Records/Shoes/Settings get a fixed two-tone aurora (Wave 3 DA) instead
 * of following the user's accent color, to give each screen its own identity.
 */
export function getPageAuroraKey(pathname: string): (typeof PAGE_AURORA_BASES)[number] | undefined {
  return PAGE_AURORA_BASES.find((base) => pathname === base || pathname.startsWith(`${base}/`))
}
