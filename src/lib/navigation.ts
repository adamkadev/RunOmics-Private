/**
 * The brand logo only anchors the Dashboard ("home"), like a native iOS app's
 * tab bar root. Every other screen is titled by its own <h1> (or, for
 * Activity detail / Map, has its own inline header) so the logo would just
 * eat vertical space without adding information.
 */
export function hasGlobalTopBar(pathname: string): boolean {
  return pathname === '/'
}

const PAGE_AURORA_BASES = ['/goals', '/records', '/shoes', '/settings', '/analytics'] as const

/**
 * Goals/Records/Shoes/Settings get a fixed two-tone aurora (Wave 3 DA) instead
 * of following the user's accent color, to give each screen its own identity.
 */
export function getPageAuroraKey(pathname: string): (typeof PAGE_AURORA_BASES)[number] | undefined {
  return PAGE_AURORA_BASES.find((base) => pathname === base || pathname.startsWith(`${base}/`))
}
