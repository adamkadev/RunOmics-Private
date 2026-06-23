const DETAIL_ROUTE_BASES = ['/goals', '/records', '/shoes', '/map', '/profile']

/**
 * Detail/secondary pages (reached from an activity row, a record, or the
 * "More" menu) get their own back bar or free title instead of the global
 * RunOmics top bar - only the 5 primary tabs keep it.
 */
export function isDetailRoute(pathname: string): boolean {
  if (pathname.startsWith('/activities/')) return true
  return DETAIL_ROUTE_BASES.some((base) => pathname === base || pathname.startsWith(`${base}/`))
}

const PAGE_AURORA_BASES = ['/goals', '/records', '/shoes', '/settings', '/analytics'] as const

/**
 * Goals/Records/Shoes/Settings get a fixed two-tone aurora (Wave 3 DA) instead
 * of following the user's accent color, to give each screen its own identity.
 */
export function getPageAuroraKey(pathname: string): (typeof PAGE_AURORA_BASES)[number] | undefined {
  return PAGE_AURORA_BASES.find((base) => pathname === base || pathname.startsWith(`${base}/`))
}
