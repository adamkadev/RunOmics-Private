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
